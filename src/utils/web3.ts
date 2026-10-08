import { ethers } from "ethers";

export function verifyWalletSignature({
  address,
  message,
  signature,
}: {
  address: string;
  message: string;
  signature: string;
}): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

export function isValidEvmAddress(address: string): boolean {
  return ethers.isAddress(address);
}
