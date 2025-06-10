import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';

export const getBlobServiceClient = (storageAccountName: string, accountKey: string) => {
  const sharedKeyCredential = new StorageSharedKeyCredential(storageAccountName, accountKey);
  return new BlobServiceClient(
    `https://${storageAccountName}.blob.core.windows.net`,
    sharedKeyCredential
  );
}

