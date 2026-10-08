import { Types } from "mongoose";
import { Certificate } from "../../models/certificate.model";
import { User } from "../../models/user.model";
import { ApiError } from "../../utils/api-error";
import { generateNonce } from "../../utils/crypto";
import { isValidEvmAddress, verifyWalletSignature } from "../../utils/web3";
import { ConnectWalletInput } from "./wallet.validation";

export class WalletService {
  static async getNonce(userId: Types.ObjectId) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound("User not found");

    const nonce = generateNonce();
    user.walletNonce = nonce;
    await user.save();

    return {
      nonce,
      message: `Sign this message to link your wallet to Si Her DeFi: ${nonce}`,
    };
  }

  static async connectWallet(userId: Types.ObjectId, { address, signature }: ConnectWalletInput) {
    if (!isValidEvmAddress(address)) {
      throw ApiError.badRequest("Invalid Ethereum / Base address format");
    }

    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound("User not found");

    // Always prove ownership: the wallet must sign the one-time nonce issued by
    // POST /wallet/nonce. Without this anyone could claim any address.
    if (!signature) {
      throw ApiError.badRequest("Please sign the message in your wallet to prove it's yours.");
    }
    if (!user.walletNonce) {
      throw ApiError.badRequest("Your signing request expired. Please connect your wallet again.");
    }
    const message = `Sign this message to link your wallet to Si Her DeFi: ${user.walletNonce}`;
    // 400 rather than 401: a bad signature must not end the learner's session
    if (!verifyWalletSignature({ address, message, signature })) {
      throw ApiError.badRequest("Wallet signature verification failed. Please sign with the wallet you're connecting.");
    }

    const normalizedAddress = address.toLowerCase();

    // Check if address is bound to another user
    const existingBinding = await User.findOne({
      walletAddress: normalizedAddress,
      _id: { $ne: user._id },
    });

    if (existingBinding) {
      throw ApiError.conflict("This wallet address is already linked to another account");
    }

    user.walletAddress = normalizedAddress;
    user.walletNonce = undefined; // clear nonce after use
    await user.save();

    // If an existing certificate is pending, update the recipient address
    await Certificate.updateOne(
      { user: user._id, status: { $ne: "minted" } },
      { recipientAddress: normalizedAddress }
    );

    return {
      address: normalizedAddress,
      chainId: "0x2105",
      network: "Base Mainnet",
      isOnBase: true,
    };
  }

  static async disconnectWallet(userId: Types.ObjectId) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound("User not found");

    user.walletAddress = undefined;
    await user.save();

    return {
      disconnected: true,
    };
  }

  static async getWalletStatus(userId: Types.ObjectId) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound("User not found");

    return {
      connected: !!user.walletAddress,
      address: user.walletAddress || null,
      chainId: user.walletAddress ? "0x2105" : null,
      network: user.walletAddress ? "Base Mainnet" : null,
      isOnBase: true,
    };
  }
}
