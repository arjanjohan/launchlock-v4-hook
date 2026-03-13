// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./DeployHelpers.s.sol";
import {DemoToken} from "../contracts/DemoToken.sol";

contract DeployDemoTokens is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        DemoToken uni = new DemoToken("Uniswap Demo", "UNI");
        DemoToken usdc = new DemoToken("USD Coin Demo", "USDC");
        DemoToken pepe = new DemoToken("Pepe Demo", "PEPE");

        uint256 faucetAmount = 1_000_000 ether;
        uni.mint(deployer, faucetAmount);
        usdc.mint(deployer, faucetAmount);
        pepe.mint(deployer, faucetAmount);

        deployments.push(Deployment({name: "DemoUNI", addr: address(uni)}));
        deployments.push(Deployment({name: "DemoUSDC", addr: address(usdc)}));
        deployments.push(Deployment({name: "DemoPEPE", addr: address(pepe)}));
    }
}
