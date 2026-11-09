// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/NVShop.sol";

interface VmNVShopDeploy {
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Deploys NVShop and configures all five catalog products.
/// @dev Refuses to run unless the connected RPC reports Arc Mainnet (chain ID 5042).
contract DeployNVShop {
    VmNVShopDeploy private constant vm =
        VmNVShopDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));

    event NVShopDeployment(address indexed contractAddress, address indexed owner, address indexed treasury);

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
        emit NVShopDeployment(address(shop), shop.owner(), shop.treasury());
    }
}
