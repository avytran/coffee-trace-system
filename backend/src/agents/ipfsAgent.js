import PinataSDK from '@pinata/sdk';
import { Readable } from 'stream';

const pinata = new PinataSDK({
  pinataApiKey: process.env.PINATA_API_KEY,
  pinataSecretKey: process.env.PINATA_SECRET_KEY
});

export const uploadIPFS = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Use key "file".'
      });
    }

    const { buffer, originalname, mimetype } = req.file;
    const readableStream = Readable.from(buffer);

    const options = {
      pinataMetadata: {
        name: `coffee-lot-${Date.now()}-${originalname}`,
        keyvalues: {
          uploadedBy: req.user.walletAddress.toLowerCase(),
          type: mimetype
        }
      },
      pinataOptions: {
        cidVersion: 1
      }
    };

    const result = await pinata.pinFileToIPFS(readableStream, options);

    return res.status(200).json({
      success: true,
      cid: result.IpfsHash,
      size: result.PinSize,
      url: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`
    });
  } catch (error) {
    console.error('[uploadIPFS] Pinata error:', error);
    return res.status(500).json({
      success: false,
      error: 'Upload to IPFS failed.',
      detail: error.message
    });
  }
};
