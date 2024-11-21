import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

// Initialize the S3 client with the configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION_,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID_,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_,
  },
});

// Function to upload image to S3
export const uploadImageToS3 = async (fileName, imageBuffer) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileName,
    Body: imageBuffer,
    ContentType: 'image/png', // Adjust this if your image type varies
  };

  // Log the start of the upload process
  logger.info('Starting image upload to S3', {
    bucket: params.Bucket,
    key: params.Key,
    region: process.env.AWS_REGION_,
  });

  try {
    // Use the `PutObjectCommand` to upload to S3
    const command = new PutObjectCommand(params);
    const data = await s3Client.send(command);

    const imageUrl = `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    logger.info('Image uploaded successfully', {
      url: imageUrl,
      bucket: params.Bucket,
      key: params.Key,
    });

    return imageUrl; // Return the URL of the uploaded image
  } catch (error) {
    logger.error('Error uploading image to S3', {
      message: error.message,
      stack: error.stack,
    });

    throw new Error(`Failed to upload image to S3: ${error.message}`);
  }
};
