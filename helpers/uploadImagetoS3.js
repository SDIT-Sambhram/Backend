import AWS from '../configs/aws.js';

const s3 = new AWS.S3();

const uploadImageToS3 = async (imageBuffer, key) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: imageBuffer,
    ContentType: 'image/png',
    ACL: 'public-read',
  };

  const uploadResult = await s3.upload(params).promise();
  return uploadResult.Location;
};

module.exports = { uploadImageToS3 };
