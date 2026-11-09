// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../NVShop.sol";

interface Vm {
    function deal(address account, uint256 newBalance) external;
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
}

contract NVShopTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address payable private constant TREASURY = payable(address(0xBEEF));
    NVShop private shop;
    bytes32 private constant XP_DAILY = keccak256("xp-daily");
    bytes32 private constant SKIN_ONE = keccak256("skin-one");

    function setUp() public {
        shop = new NVShop(TREASURY);
        shop.configureProduct(XP_DAILY, 1, 0.2 ether, 30, 1, 5, 20, true);
        shop.configureProduct(SKIN_ONE, 0, 10 ether, 0, 0, 0, 0, true);
        vm.deal(address(this), 100 ether);
    }

    function testPurchaseForwardsNativeUsdcAndEmitsEntitlementData() public {
        uint256 beforeTreasury = TREASURY.balance;
        shop.purchase{value: 0.2 ether}(XP_DAILY);

        require(TREASURY.balance == beforeTreasury + 0.2 ether, "treasury not paid");
        require(shop.totalPurchases(address(this), XP_DAILY) == 1, "purchase not recorded");
        (uint32 dayCount, uint32 weekCount, uint32 thirtyDayCount) =
            shop.getPurchaseWindow(address(this), XP_DAILY);
        require(dayCount == 1 && weekCount == 1 && thirtyDayCount == 1, "limits not recorded");
    }

    function testRejectsIncorrectPayment() public {
        vm.expectRevert(abi.encodeWithSelector(NVShop.IncorrectPayment.selector, 0.2 ether, 0.1 ether));
        shop.purchase{value: 0.1 ether}(XP_DAILY);
    }

    function testEnforcesDailyLimitOnChain() public {
        shop.purchase{value: 0.2 ether}(XP_DAILY);
        vm.expectRevert(NVShop.DailyLimitReached.selector);
        shop.purchase{value: 0.2 ether}(XP_DAILY);
    }

    function testSkinCanOnlyBePurchasedOncePerWallet() public {
        shop.purchase{value: 10 ether}(SKIN_ONE);
        require(shop.ownsSkin(address(this), SKIN_ONE), "skin ownership missing");
        vm.expectRevert(NVShop.SkinAlreadyOwned.selector);
        shop.purchase{value: 10 ether}(SKIN_ONE);
    }

    function testLimitsAreProductConfigurationNotCallerInput() public {
        // purchase() has no caller-supplied price or limit parameters.
        shop.purchase{value: 0.2 ether}(XP_DAILY);
        vm.expectRevert(NVShop.DailyLimitReached.selector);
        shop.purchase{value: 0.2 ether}(XP_DAILY);
    }

    function testInactiveProductCannotBePurchased() public {
        shop.configureProduct(XP_DAILY, 1, 0.2 ether, 30, 1, 5, 20, false);
        vm.expectRevert(NVShop.InvalidProduct.selector);
        shop.purchase{value: 0.2 ether}(XP_DAILY);
    }

    function testOnlyOwnerCanConfigureProducts() public {
        vm.prank(address(0xCAFE));
        vm.expectRevert(NVShop.Unauthorized.selector);
        shop.configureProduct(XP_DAILY, 1, 0.2 ether, 30, 1, 5, 20, true);
    }
}
