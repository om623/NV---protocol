// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/NVShop.sol";

/// @notice Deploys NVShop and configures the five catalog products in one broadcast.
/// @dev Refuses to broadcast unless the RPC reports Arc Mainnet (chain ID 5042).
contract DeployNVShop is Script {
    function run() external {
        require(block.chainid == 5042, "Wrong network: expected Arc Mainnet (5042)");
        uint256 deployerKey = vm.envUint("NV_DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        NVShop shop = new NVShop();

        shop.configureProduct(keccak256(bytes("xp-daily")), 1, 200000000000000000, 30, 1, 5, 20, true);
        shop.configureProduct(keccak256(bytes("xp-weekly")), 1, 500000000000000000, 60, 1, 3, 12, true);
        shop.configureProduct(keccak256(bytes("xp-quarterly")), 1, 1000000000000000000, 300, 1, 1, 4, true);
        shop.configureProduct(keccak256(bytes("premium-500")), 0, 10000000000000000000, 0, 1, 2, 4, true);
        shop.configureProduct(keccak256(bytes("premium-1000")), 0, 20000000000000000000, 0, 1, 1, 2, true);

        vm.stopBroadcast();

        require(
            shop.treasury() == 0xAd397122941D03450c70d0076379e079334D434f,
            "Unexpected treasury"
        );
        console2.log("NVShop deployed and all five products configured.");
        console2.log("Contract address:", address(shop));
        console2.log("Owner:", shop.owner());
        console2.log("Official treasury:", shop.treasury());
    }
}
