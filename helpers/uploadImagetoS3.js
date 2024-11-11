import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the S3 client with the configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
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
  console.log("Bucket:", process.env.AWS_BUCKET_NAME);
  console.log("Key (fileName):", fileName);
  console.log("Body (imageBuffer type):", typeof imageBuffer);

  try {
    // Use the `PutObjectCommand` to upload to S3
    const command = new PutObjectCommand(params);
    const data = await s3Client.send(command);
    const imageUrl = `https://${params.Bucket}.s3.${process.env.AWS_REGION_}.amazonaws.com/${fileName}`;
    console.log('Image uploaded successfully:', imageUrl);
    return imageUrl; // Return the URL of the uploaded image
  } catch (error) {
    console.error('Error uploading image to S3:', error);
    throw error;
  }
};
