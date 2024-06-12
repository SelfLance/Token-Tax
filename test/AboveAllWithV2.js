const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AboveAll Token", function () {
  let AboveAll, aboveAll, owner, addr1, addr2, taxWallet, otherAccounts;
  let uniswapV2Factory, uniswapV2Router, weth;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    AboveAll = await ethers.getContractFactory("AboveAll");
    [owner, addr1, addr2, taxWallet, ...otherAccounts] = await ethers.getSigners();

    // Deploy UniswapV2Factory
    const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
    uniswapV2Factory = await UniswapV2Factory.deploy(owner.address);
    await uniswapV2Factory.deployed();

    // Deploy WETH
    const WETH = await ethers.getContractFactory("WETH9");
    weth = await WETH.deploy();
    await weth.deployed();

    // Deploy UniswapV2Router02
    const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
    uniswapV2Router = await UniswapV2Router02.deploy(uniswapV2Factory.address, weth.address);
    await uniswapV2Router.deployed();

    // Deploy AboveAll token contract
    aboveAll = await AboveAll.deploy(owner.address);
    await aboveAll.deployed();

    // Open trading
    await aboveAll.openTrading();
  });

  describe("Transfer", function () {
    it("Should transfer tokens successfully", async function () {
      const amount = ethers.utils.parseUnits("1000", 18);

      await aboveAll.transfer(addr1.address, amount);

      const addr1Balance = await aboveAll.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(amount);
    });

    it("Should fail if transfer amount exceeds balance", async function () {
      const amount = ethers.utils.parseUnits("1000", 18);
      await expect(
        aboveAll.connect(addr1).transfer(addr2.address, amount)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should fail if transfer from zero address", async function () {
      await expect(
        aboveAll._transfer(ethers.constants.AddressZero, addr1.address, 100)
      ).to.be.revertedWith("ERC20: transfer from the zero address");
    });

    it("Should fail if transfer to zero address", async function () {
      await expect(
        aboveAll.transfer(ethers.constants.AddressZero, 100)
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });

    it("Should apply buy tax on transfer", async function () {
      const amount = ethers.utils.parseUnits("1000", 18);
      const taxPercentage = 5;
      await aboveAll.setBuyTax(taxPercentage);

      const taxAmount = amount.mul(taxPercentage).div(100);
      const transferAmount = amount.sub(taxAmount);

      await aboveAll.transfer(addr1.address, amount);

      const addr1Balance = await aboveAll.balanceOf(addr1.address);
      const taxWalletBalance = await aboveAll.balanceOf(taxWallet.address);

      expect(addr1Balance).to.equal(transferAmount);
      expect(taxWalletBalance).to.equal(taxAmount);
    });

    it("Should apply sell tax on transfer", async function () {
      const amount = ethers.utils.parseUnits("1000", 18);
      const taxPercentage = 5;
      await aboveAll.setSellTax(taxPercentage);

      await aboveAll.transfer(addr1.address, amount);
      await aboveAll.connect(addr1).approve(aboveAll.address, amount);
      await aboveAll.setRouterAddress(uniswapV2Router.address, true);
      await aboveAll.setPairAddress(uniswapV2Router.address, true);

      const taxAmount = amount.mul(taxPercentage).div(100);
      const transferAmount = amount.sub(taxAmount);

      await aboveAll.connect(addr1).transfer(addr2.address, amount);

      const addr2Balance = await aboveAll.balanceOf(addr2.address);
      const taxWalletBalance = await aboveAll.balanceOf(taxWallet.address);

      expect(addr2Balance).to.equal(transferAmount);
      expect(taxWalletBalance).to.equal(taxAmount);
    });

    it("Should exclude address from fee", async function () {
      const amount = ethers.utils.parseUnits("1000", 18);
      const taxPercentage = 5;
      await aboveAll.setBuyTax(taxPercentage);

      await aboveAll.excludeFromFee(addr1.address);
      await aboveAll.transfer(addr1.address, amount);

      const addr1Balance = await aboveAll.balanceOf(addr1.address);

      expect(addr1Balance).to.equal(amount);
    });

    it("Should include address in fee", async function () {
      const amount = ethers.utils.parseUnits("1000", 18);
      const taxPercentage = 5;
      await aboveAll.setBuyTax(taxPercentage);

      await aboveAll.excludeFromFee(addr1.address);
      await aboveAll.transfer(addr1.address, amount);

      const addr1BalanceBefore = await aboveAll.balanceOf(addr1.address);
      await aboveAll.includeInFee(addr1.address);

      const taxAmount = amount.mul(taxPercentage).div(100);
      const transferAmount = amount.sub(taxAmount);

      await aboveAll.connect(addr1).transfer(addr2.address, amount);

      const addr1BalanceAfter = await aboveAll.balanceOf(addr
