// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title NVShop
/// @notice On-chain purchase registry for the NV shop on Arc.
/// @dev Arc native USDC is paid as msg.value (18 decimal native precision).
///      Prices, XP amounts and purchase limits are authoritative on-chain.
contract NVShop {
    enum ProductType { Skin, XP }

    struct Product {
        uint256 price;
        uint32 xpAmount;
        uint32 maxPerDay;
        uint32 maxPerWeek;
        uint32 maxPer30Days;
        uint8 productType;
        bool active;
    }

    address public owner;
    address payable public immutable treasury;

    mapping(bytes32 => Product) public products;
    mapping(address => mapping(bytes32 => bool)) public ownsSkin;
    mapping(address => mapping(bytes32 => uint256)) public totalPurchases;
    mapping(bytes32 => bool) public configuredProducts;
    mapping(bytes32 => uint32) private periodCounts;

    uint256 private entered = 1;

    error Unauthorized();
    error ZeroAddress();
    error InvalidProduct();
    error InvalidProductType();
    error InvalidPrice();
    error IncorrectPayment(uint256 expected, uint256 received);
    error SkinAlreadyOwned();
    error DailyLimitReached();
    error WeeklyLimitReached();
    error ThirtyDayLimitReached();
    error TreasuryTransferFailed();
    error ReentrantCall();

    event ProductConfigured(
        bytes32 indexed productId,
        uint8 productType,
        uint256 price,
        uint32 xpAmount,
        uint32 maxPerDay,
        uint32 maxPerWeek,
        uint32 maxPer30Days,
        bool active
    );
    event PurchaseCompleted(
        address indexed buyer,
        bytes32 indexed productId,
        uint8 productType,
        uint256 amount,
        uint32 xpAmount,
        uint256 timestamp
    );
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (entered != 1) revert ReentrantCall();
        entered = 2;
        _;
        entered = 1;
    }

    /// @notice Official NV receiving wallet recovered from the original Profile/Shop configuration.
    address payable private constant OFFICIAL_TREASURY = payable(0xAd397122941D03450c70d0076379e079334D434f);

    constructor() {
        owner = msg.sender;
        treasury = OFFICIAL_TREASURY;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    /// @notice Configure an authoritative product and its limits.
    /// @dev Zero limit means unlimited. Skin products are always one-time per wallet.
    function configureProduct(
        bytes32 productId,
        uint8 productType,
        uint256 price,
        uint32 xpAmount,
        uint32 maxPerDay,
        uint32 maxPerWeek,
        uint32 maxPer30Days,
        bool active
    ) external onlyOwner {
        if (productId == bytes32(0)) revert InvalidProduct();
        if (productType > uint8(ProductType.XP)) revert InvalidProductType();
        if (price == 0) revert InvalidPrice();
        if (productType == uint8(ProductType.Skin) && xpAmount != 0) revert InvalidProduct();
        if (productType == uint8(ProductType.XP) && xpAmount == 0) revert InvalidProduct();

        products[productId] = Product({
            price: price,
            xpAmount: xpAmount,
            maxPerDay: maxPerDay,
            maxPerWeek: maxPerWeek,
            maxPer30Days: maxPer30Days,
            productType: productType,
            active: active
        });
        configuredProducts[productId] = true;

        emit ProductConfigured(
            productId, productType, price, xpAmount,
            maxPerDay, maxPerWeek, maxPer30Days, active
        );
    }

    /// @notice Purchase a product using Arc native USDC.
    /// @param productId keccak256(bytes(product ID string)), e.g. keccak256("xp-daily").
    function purchase(bytes32 productId) external payable nonReentrant {
        Product memory product = products[productId];
        if (!configuredProducts[productId] || !product.active) revert InvalidProduct();
        if (msg.value != product.price) revert IncorrectPayment(product.price, msg.value);

        if (product.productType == uint8(ProductType.Skin)) {
            if (ownsSkin[msg.sender][productId]) revert SkinAlreadyOwned();
            ownsSkin[msg.sender][productId] = true;
        } else {
            _enforceAndUpdateLimits(msg.sender, productId, product);
        }

        totalPurchases[msg.sender][productId] += 1;

        (bool sent, ) = treasury.call{value: msg.value}("");
        if (!sent) revert TreasuryTransferFailed();

        emit PurchaseCompleted(
            msg.sender, productId, product.productType,
            msg.value, product.xpAmount, block.timestamp
        );
    }

    function _enforceAndUpdateLimits(
        address buyer,
        bytes32 productId,
        Product memory product
    ) private {
        uint32 dayKey = uint32(block.timestamp / 1 days);
        uint32 weekKey = uint32(block.timestamp / 1 weeks);
        // The 30-day window is fixed-length and UTC-aligned to the Unix epoch.
        uint32 thirtyDayKey = uint32(block.timestamp / 30 days);

        uint32 dayCount = _periodCount(buyer, productId, 0, dayKey);
        uint32 weekCount = _periodCount(buyer, productId, 1, weekKey);
        uint32 thirtyDayCount = _periodCount(buyer, productId, 2, thirtyDayKey);

        if (product.maxPerDay != 0 && dayCount >= product.maxPerDay) revert DailyLimitReached();
        if (product.maxPerWeek != 0 && weekCount >= product.maxPerWeek) revert WeeklyLimitReached();
        if (product.maxPer30Days != 0 && thirtyDayCount >= product.maxPer30Days) {
            revert ThirtyDayLimitReached();
        }

        _setPeriodCount(buyer, productId, 0, dayKey, dayCount + 1);
        _setPeriodCount(buyer, productId, 1, weekKey, weekCount + 1);
        _setPeriodCount(buyer, productId, 2, thirtyDayKey, thirtyDayCount + 1);
    }

    function _periodSlot(
        address buyer,
        bytes32 productId,
        uint8 period,
        uint32 key
    ) private pure returns (bytes32) {
        return keccak256(abi.encode(buyer, productId, period, key));
    }

    function _periodCount(
        address buyer,
        bytes32 productId,
        uint8 period,
        uint32 key
    ) private view returns (uint32) {
        return periodCounts[_periodSlot(buyer, productId, period, key)];
    }

    function _setPeriodCount(
        address buyer,
        bytes32 productId,
        uint8 period,
        uint32 key,
        uint32 count
    ) private {
        periodCounts[_periodSlot(buyer, productId, period, key)] = count;
    }

    function getPurchaseWindow(
        address buyer,
        bytes32 productId
    ) external view returns (uint32 dayCount, uint32 weekCount, uint32 thirtyDayCount) {
        uint32 dayKey = uint32(block.timestamp / 1 days);
        uint32 weekKey = uint32(block.timestamp / 1 weeks);
        uint32 thirtyDayKey = uint32(block.timestamp / 30 days);
        return (
            _periodCount(buyer, productId, 0, dayKey),
            _periodCount(buyer, productId, 1, weekKey),
            _periodCount(buyer, productId, 2, thirtyDayKey)
        );
    }
}
