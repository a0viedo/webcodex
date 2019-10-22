import * as AWS from 'aws-sdk';
import { uploadToS3, runCommand } from '../../utils';
import * as fs from 'fs';
import * as path from 'path';
import * as imagemin from 'imagemin';
import * as imageminWebp from 'imagemin-webp';
import * as util from 'util';

const s3 = new AWS.S3();
const writeFile = util.promisify(fs.writeFile);

exports.handler = async function handler(event, context) {
  const filesInBucket = await listFilesInBucket(process.env.S3_BUCKET);

  console.log('files in bucket', filesInBucket);

  const imageFiles = filesInBucket.filter(x=> path.extname(x.Key) === '.png');

  console.log('image files', imageFiles);

  await Promise.all(imageFiles.map(file => downloadFile(`/tmp/${file.Key}`, process.env.S3_BUCKET, file.Key)));

  console.log('downloaded image files');
  const files = await imagemin(['/tmp/*.{jpg,png}'], {
    plugins: [
      imageminWebp({
        quality: Number(process.env.IMAGE_QUALITY),
        crop: {
          x: 0,
          y: 0,
          width: Number(process.env.IMAGE_WIDTH),
          height: Number(process.env.IMAGE_HEIGHT)
        }
      })
    ]
  });

  // uplood files
  const result = await Promise.all(files.map(file => uploadFile(file)));
  console.log('finished optimizing images', result);

  await runCommand('rm -r /tmp/*');
};

async function uploadFile(file) {
  return uploadToS3(process.env.S3_BUCKET, path.basename(file.sourcePath).replace(/\.png/, '.webp'), file.data);
}

async function listFilesInBucket(bucket) {
  var params = {
    Bucket: bucket,
    Delimiter: '/',
  };
  const { Contents } = await s3.listObjectsV2(params).promise();
  return Contents;
}

async function downloadFile(filePath, bucketName, key){
  const params = {
    Bucket: bucketName,
    Key: key
  };
  const data = await s3.getObject(params).promise();
  return writeFile(filePath, data.Body);
}