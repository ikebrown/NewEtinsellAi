///services/blockchain-service/src/services/eti-token.service.ts``typescript

import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) public returns (bool)',
  'function balanceOf(address account) public view returns (uint256)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function approve(address spender, uint256 amount) public returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export class ETITokenService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private platformFee: number;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ETI_RPC_URL);
    this.wallet = new ethers.Wallet(process.env.ETI_PRIVATE_KEY!, this.provider);
    this.contract = new ethers.Contract(
      process.env.ETI_CONTRACT_ADDRESS!,
      ERC20_ABI,
      this.wallet
    );
    this.platformFee = parseFloat(process.env.ETI_PLATFORM_FEE_PERCENTAGE!) / 100;
  }

  // Send tip with platform fee
  async sendTip(fromWallet: string, toUserId: string, amount: number) {
    const toUser = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { walletAddress: true },
    });

    if (!toUser?.walletAddress) {
      throw new Error('Recipient wallet not found');
    }

    // Calculate platform fee
    const platformFeeAmount = amount * this.platformFee;
    const recipientAmount = amount - platformFeeAmount;

    const amountWei = ethers.parseUnits(recipientAmount.toString(), 18);
    const feeWei = ethers.parseUnits(platformFeeAmount.toString(), 18);

    // Transfer to recipient
    const tx1 = await this.contract.transfer(toUser.walletAddress, amountWei);
    await tx1.wait();

    // Transfer fee to platform
    const platformWallet = process.env.PLATFORM_WALLET_ADDRESS!;
    const tx2 = await this.contract.transfer(platformWallet, feeWei);
    await tx2.wait();

    // Record transaction
    await prisma.transaction.create({
      data: {
        userId: toUserId,
        type: 'TIP',
        amount: recipientAmount,
        currency: 'ETI',
        status: 'SUCCESS',
        description: `Tip received (${platformFeeAmount} ETI platform fee)`,
      },
    });

    return {
      success: true,
      txHash: tx1.hash,
      amount: recipientAmount,
      fee: platformFeeAmount,
    };
  }

  // Get ETI balance
  async getBalance(walletAddress: string) {
    const balance = await this.contract.balanceOf(walletAddress);
    return ethers.formatUnits(balance, 18);
  }

  // Purchase with ETI tokens
  async purchaseWithETI(userId: string, productType: string, etiAmount: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.walletAddress) {
      throw new Error('User wallet not found');
    }

    // Check balance
    const balance = await this.getBalance(user.walletAddress);
    if (parseFloat(balance) < etiAmount) {
      throw new Error('Insufficient ETI balance');
    }

    // Transfer tokens to platform
    const amountWei = ethers.parseUnits(etiAmount.toString(), 18);
    const platformWallet = process.env.PLATFORM_WALLET_ADDRESS!;
    
    const tx = await this.contract.transfer(platformWallet, amountWei);
    await tx.wait();

    // Grant product/feature
    await this.grantProduct(userId, productType);

    // Record transaction
    await prisma.transaction.create({
      data: {
        userId,
        type: productType as any,
        amount: etiAmount,
        currency: 'ETI',
        status: 'SUCCESS',
      },
    });

    return { success: true, txHash: tx.hash };
  }

  private async grantProduct(userId: string, productType: string) {
    const updates: any = {};

    switch (productType) {
      case 'SUPER_LIKE':
        // Grant super likes
        break;
      case 'BOOST':
        // Grant boost
        break;
      case 'VERIFIED_BADGE':
        updates.hasBadge = true;
        updates.badgeType = 'VERIFIED';
        break;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updates,
      });
    }
  }

  // Stake tokens for visibility boost
  async stakeTokens(userId: string, amount: number, duration: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.walletAddress) {
      throw new Error('User wallet not found');
    }

    const amountWei = ethers.parseUnits(amount.toString(), 18);
    const stakingContract = process.env.STAKING_CONTRACT_ADDRESS!;

    // Transfer to staking contract
    const tx = await this.contract.transfer(stakingContract, amountWei);
    await tx.wait();

    // Record stake
    const expiryDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    
    // Store in database (you'd create a Stake model)
    // For now, just return success
    
    return {
      success: true,
      txHash: tx.hash,
      amount,
      expiryDate,
    };
  }
}