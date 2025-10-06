////services/blockchain-service/src/index.ts`typescript

import express from 'express';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// NFT Contract ABI (simplified)
const NFT_ABI = [
  'function mintVerificationBadge(address to, string memory tokenURI) public returns (uint256)',
  'function ownerOf(uint256 tokenId) public view returns (address)',
  'function tokenURI(uint256 tokenId) public view returns (string memory)',
];

const nftContract = new ethers.Contract(
  process.env.NFT_CONTRACT_ADDRESS!,
  NFT_ABI,
  wallet
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'blockchain-service' });
});

app.post('/api/v1/blockchain/mint-verification', async (req, res) => {
  try {
    const { userId, walletAddress, metadata } = req.body;

    // Upload metadata to IPFS (simplified - use Pinata or similar)
    const tokenURI = `ipfs://QmExample/${userId}`;

    // Mint NFT
    const tx = await nftContract.mintVerificationBadge(
      walletAddress,
      tokenURI
    );
    const receipt = await tx.wait();

    // Extract token ID from events
    const event = receipt.logs.find((log: any) => log.event === 'Transfer');
    const tokenId = event?.args?.tokenId.toString();

    res.json({
      success: true,
      tokenId,
      txHash: receipt.hash,
      tokenURI,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/blockchain/verify/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;

    const owner = await nftContract.ownerOf(tokenId);
    const tokenURI = await nftContract.tokenURI(tokenId);

    res.json({
      verified: true,
      owner,
      tokenURI,
    });
  } catch (error: any) {
    res.status(404).json({ verified: false, error: error.message });
  }
});

const PORT = process.env.BLOCKCHAIN_SERVICE_PORT || 3010;
app.listen(PORT, () => {
  console.log(`⛓️  Blockchain Service running on port ${PORT}`);
});