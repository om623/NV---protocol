// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title NVShop
/// @notice Non-custodial purchase registry for the NV shop on Arc.
/// @dev Arc native USDC is sent as msg.value (18 decimal native precision).
///      Product configuration is written on-chain by the owner; every purchase
///      is verified and recorded atomically by this contract.
contract NVShop {
    enum ProductType {
        Skin,
        XP
    }

    struct Product {
        uint256 price; // Native USDC units (18 decimals on Arc)
        uint32 xpAmount;
        uint8 productType; // 0 = skin, 1 = XP
        bool active;
    }

    struct PurchaseWindow {
        uint32 day;
        uint32 week;
        uint32 month;
    }

    address public owner;
    address payable public immutable treasury;

    mapping(bytes32 => Product) public products;
    mapping(address => mapping(bytes32 => bool)) public ownsSkin;
    mapping(address => mapping(bytes32 => PurchaseWindow)) private purchaseWindows;
    mapping(address => mapping(bytes32 => uint256)) public totalPurchases;
    mapping(bytes32 => bool) public configuredProducts;

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
    error MonthlyLimitReached();
    error TreasuryTransferFailed();
    error ReentrantCall();

    event ProductConfigured(
        bytes32 indexed productId,
        uint8 productType,
        uint256 price,
        uint32 xpAmount,
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

    constructor(address payable treasuryAddress) {
        if (treasuryAddress == address(0)) revert ZeroAddress();
        owner = msg.sender;
        treasury = treasuryAddress;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    /// @notice Configure a product. Limits are enforced for XP products;
    ///         skin products are limited to one purchase per wallet.
    function configureProduct(
        bytes32 productId,
        uint8 productType,
        uint256 price,
        uint32 xpAmount,
        bool active
    ) external onlyOwner {
        if (productId == bytes32(0)) revert InvalidProduct();
        if (productType > uint8(ProductType.XP)) revert InvalidProductType();
        if (price == 0) revert InvalidPrice();
        if (productType == uint8(ProductType.Skin) && xpAmount != 0) {
            revert InvalidProduct();
        }
        if (productType == uint8(ProductType.XP) && xpAmount == 0) {
            revert InvalidProduct();
        }

        products[productId] = Product({
            price: price,
            xpAmount: xpAmount,
            productType: productType,
            active: active
        });
        configuredProducts[productId] = true;

        emit ProductConfigured(productId, productType, price, xpAmount, active);
    }

    /// @notice Purchase a configured shop product using Arc's native USDC.
    /// @param productId keccak256(bytes(product ID string)), e.g. keccak256("xp-daily").
    /// @param maxPerDay Maximum purchases in the current UTC day (0 disables the cap).
    /// @param maxPerWeek Maximum purchases in the current UTC week (0 disables the cap).
    /// @param maxPerMonth Maximum purchases in the current UTC month (0 disables the cap).
    function purchase(
        bytes32 productId,
        uint32 maxPerDay,
        uint32 maxPerWeek,
        uint32 maxPerMonth
    ) external payable nonReentrant {
        Product memory product = products[productId];
        if (!configuredProducts[productId] || !product.active) revert InvalidProduct();
        if (msg.value != product.price) {
            revert IncorrectPayment(product.price, msg.value);
        }

        if (product.productType == uint8(ProductType.Skin)) {
            if (ownsSkin[msg.sender][productId]) revert SkinAlreadyOwned();
            ownsSkin[msg.sender][productId] = true;
        } else {
            _enforceAndUpdateLimits(
                msg.sender,
                productId,
                maxPerDay,
                maxPerWeek,
                maxPerMonth
            );
        }

        totalPurchases[msg.sender][productId] += 1;

        (bool sent, ) = treasury.call{value: msg.value}("");
        if (!sent) revert TreasuryTransferFailed();

        emit PurchaseCompleted(
            msg.sender,
            productId,
            product.productType,
            msg.value,
            product.xpAmount,
            block.timestamp
        );
    }

    function _enforceAndUpdateLimits(
        address buyer,
        bytes32 productId,
        uint32 maxPerDay,
        uint32 maxPerWeek,
        uint32 maxPerMonth
    ) private {
        uint32 dayKey = uint32(block.timestamp / 1 days);
        uint32 weekKey = uint32(block.timestamp / 1 weeks);
        uint32 monthKey = uint32(block.timestamp / 30 days);

        PurchaseWindow storage window = purchaseWindows[buyer][productId];

        if (window.day != dayKey) window.day = dayKey;
        if (window.week != weekKey) window.week = weekKey;
        if (window.month != monthKey) window.month = monthKey;

        // Counters are stored separately per period to avoid reset ambiguity.
        // The packed values below are the current-period counts.
        uint32 dayCount = _periodCount(buyer, productId, 0, dayKey);
        uint32 weekCount = _periodCount(buyer, productId, 1, weekKey);
        uint32 monthCount = _periodCount(buyer, productId, 2, monthKey);

        if (maxPerDay != 0 && dayCount >= maxPerDay) revert DailyLimitReached();
        if (maxPerWeek != 0 && weekCount >= maxPerWeek) revert WeeklyLimitReached();
        if (maxPerMonth != 0 && monthCount >= maxPerMonth) revert MonthlyLimitReached();

        _setPeriodCount(buyer, productId, 0, dayKey, dayCount + 1);
        _setPeriodCount(buyer, productId, 1, weekKey, weekCount + 1);
        _setPeriodCount(buyer, productId, 2, monthKey, monthCount + 1);
    }

    mapping(bytes32 => uint32) private periodCounts;

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

    function getProduct(bytes32 productId) external view returns (Product memory) {
        return products[productId];
    }

    function getPurchaseWindow(
        address buyer,
        bytes32 productId
    ) external view returns (uint32 dayCount, uint32 weekCount, uint32 monthCount) {
        uint32 dayKey = uint32(block.timestamp / 1 days);
        uint32 weekKey = uint32(block.timestamp / 1 weeks);
        uint32 monthKey = uint32(block.timestamp / 30 days);

        return (
            _periodCount(buyer, productId, 0, dayKey),
            _periodCount(buyer, productId, 1, weekKey),
            _periodCount(buyer, productId, 2, monthKey)
        );
    }
}
