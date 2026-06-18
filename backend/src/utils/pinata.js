import pinataSDK from '@pinata/sdk';

export const pinata = new pinataSDK(
  process.env.PINATA_API_KEY || "YOUR_PINATA_API_KEY", 
  process.env.PINATA_SECRET_API_KEY || "YOUR_PINATA_SECRET_KEY"
);