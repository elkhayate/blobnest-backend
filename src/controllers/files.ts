import { Response } from "express";
import { UserRequest } from "../types";
import { supabaseAdmin } from "../services/supabase";
import { getBlobServiceClient } from "../services/blop";
import logger from "../config/logger";
import { 
    getFilesQuerySchema, 
    uploadFileSchema, 
    updateFileSchema, 
    fileParamsSchema 
} from "../validations/files";
import { BlobSASPermissions } from "@azure/storage-blob";

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function getFileDetails(blobClient: any) {
    const properties = await blobClient.getProperties();
    const metadata = properties.metadata || {};
    
    // Format metadata for display
    const formattedMetadata = Object.entries(metadata).map(([key, value]) => ({
        key,
        value: String(value),
        type: typeof value
    }));

    return {
        name: blobClient.name,
        contentType: properties.contentType,
        size: formatBytes(properties.contentLength),
        lastModified: properties.lastModified,
        createdOn: properties.createdOn,
        metadata: formattedMetadata,
        rawMetadata: metadata,
        url: blobClient.url,
        etag: properties.etag,
        lastModifiedBy: metadata.lastModifiedBy || 'Unknown',
        description: metadata.description || '',
        tags: metadata.tags ? metadata.tags.split(',') : [],
        previewUrl: blobClient.url
    };
}

export const getFiles = async (req: UserRequest, res: Response) => {
    try {
        const queryResult = getFilesQuerySchema.safeParse(req.query);
        if (!queryResult.success) {
            return res.status(400).json({ error: queryResult.error.format() });
        }

        const { search, contentType, page, rowsPerPage } = queryResult.data;
        const containerName = req.params.containerName;

        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { data: company, error: companyError } = await supabaseAdmin
            .from('companies')
            .select('storage_account_name, sas_token')
            .eq('company_id', authUser.user_metadata?.company_id)
            .single();

        if (companyError) throw companyError;
        if (!company) {
            return res.status(404).json({ error: "Company not found" });
        }

        const blobServiceClient = getBlobServiceClient(company.storage_account_name, company.sas_token);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobsIterator = containerClient.listBlobsFlat();
        const filesList = [];
        
        for await (const blob of blobsIterator) {
            const blobClient = containerClient.getBlobClient(blob.name);
            const fileDetails = await getFileDetails(blobClient);
            filesList.push(fileDetails);
        }

        let filteredFiles = filesList;
        if (search) {
            filteredFiles = filteredFiles.filter(file => 
                file.name.toLowerCase().includes(search.toLowerCase()) ||
                Object.entries(file.metadata).some(([_, value]) => 
                    String(value).toLowerCase().includes(search.toLowerCase())
                )
            );
        }

        if (contentType) {
            filteredFiles = filteredFiles.filter(file => 
                file.contentType === contentType
            );
        }

        const total = filteredFiles.length;
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const paginatedFiles = filteredFiles.slice(start, end);

        res.json({
            files: paginatedFiles,
            total,
            page,
            rowsPerPage,
            totalPages: Math.ceil(total / rowsPerPage)
        });
    } catch (error) {
        logger.error("Error getting files:", error);
        res.status(500).json({ error: "Failed to get files" });
    }
};

export const uploadFile = async (req: UserRequest & { file?: Express.Multer.File }, res: Response) => {
    try {
        const validationResult = uploadFileSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({ error: validationResult.error.format() });
        }

        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { containerName, metadata } = validationResult.data;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const { data: company, error: companyError } = await supabaseAdmin
            .from('companies')
            .select('storage_account_name, sas_token')
            .eq('company_id', authUser.user_metadata?.company_id)
            .single();

        if (companyError) throw companyError;
        if (!company) {
            return res.status(404).json({ error: "Company not found" });
        }

        const blobServiceClient = getBlobServiceClient(company.storage_account_name, company.sas_token);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(file.originalname);

        const options = {
            blobHTTPHeaders: {
                blobContentType: file.mimetype
            },
            metadata: metadata ? JSON.parse(metadata) : {}
        };

        await blockBlobClient.uploadData(file.buffer, options);
        const fileDetails = await getFileDetails(blockBlobClient);

        res.status(201).json(fileDetails);
    } catch (error) {
        logger.error("Error uploading file:", error);
        res.status(500).json({ error: "Failed to upload file" });
    }
};

export const updateFile = async (req: UserRequest, res: Response) => {
    try {
        const paramsResult = fileParamsSchema.safeParse(req.params);
        if (!paramsResult.success) {
            return res.status(400).json({ error: paramsResult.error.format() });
        }

        const validationResult = updateFileSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({ error: validationResult.error.format() });
        }

        const { containerName, fileName } = paramsResult.data;
        const { metadata, contentType } = validationResult.data;

        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { data: company, error: companyError } = await supabaseAdmin
            .from('companies')
            .select('storage_account_name, sas_token')
            .eq('company_id', authUser.user_metadata?.company_id)
            .single();

        if (companyError) throw companyError;
        if (!company) {
            return res.status(404).json({ error: "Company not found" });
        }

        const blobServiceClient = getBlobServiceClient(company.storage_account_name, company.sas_token);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlobClient(fileName);

        if (metadata) {
            await blockBlobClient.setMetadata(metadata);
        }

        if (contentType) {
            await blockBlobClient.setHTTPHeaders({
                blobContentType: contentType
            });
        }

        const fileDetails = await getFileDetails(blockBlobClient);
        const response = {
            ...fileDetails,
            containerName
        };
        res.json(response);
    } catch (error) {
        logger.error("Error updating file:", error);
        res.status(500).json({ error: "Failed to update file" });
    }
};

export const deleteFile = async (req: UserRequest, res: Response) => {
    try {
        const paramsResult = fileParamsSchema.safeParse(req.params);
        if (!paramsResult.success) {
            return res.status(400).json({ error: paramsResult.error.format() });
        }

        const { containerName, fileName } = paramsResult.data;

        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { data: company, error: companyError } = await supabaseAdmin
            .from('companies')
            .select('storage_account_name, sas_token')
            .eq('company_id', authUser.user_metadata?.company_id)
            .single();

        if (companyError) throw companyError;
        if (!company) {
            return res.status(404).json({ error: "Company not found" });
        }

        const blobServiceClient = getBlobServiceClient(company.storage_account_name, company.sas_token);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);

        await blockBlobClient.delete();

        res.json({ message: "File deleted successfully" });
    } catch (error) {
        logger.error("Error deleting file:", error);
        res.status(500).json({ error: "Failed to delete file" });
    }
};


export const getAllFiles = async (req: UserRequest, res: Response) => {
    try {
        const queryResult = getFilesQuerySchema.safeParse(req.query);
        if (!queryResult.success) {
            return res.status(400).json({ error: queryResult.error.format() });
        }

        const { search, contentType, page, rowsPerPage } = queryResult.data;

        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { data: company, error: companyError } = await supabaseAdmin
            .from('companies')
            .select('storage_account_name, sas_token')
            .eq('company_id', authUser.user_metadata?.company_id)
            .single();

        if (companyError) throw companyError;
        if (!company) {
            return res.status(404).json({ error: "Company not found" });
        }

        const blobServiceClient = getBlobServiceClient(company.storage_account_name, company.sas_token);
        const containersIterator = blobServiceClient.listContainers();
        const allFiles = [];
        
        for await (const container of containersIterator) {
            const containerClient = blobServiceClient.getContainerClient(container.name);
            const blobsIterator = containerClient.listBlobsFlat();
            
            for await (const blob of blobsIterator) {
                const blobClient = containerClient.getBlobClient(blob.name);
                const fileDetails = await getFileDetails(blobClient);
                allFiles.push({
                    ...fileDetails,
                    containerName: container.name,
                    previewUrl: fileDetails.url
                });
            }
        }
        
        let filteredFiles = allFiles;
        if (search) {
            filteredFiles = filteredFiles.filter(file => 
                file.name.toLowerCase().includes(search.toLowerCase()) ||
                file.containerName.toLowerCase().includes(search.toLowerCase()) ||
                Object.entries(file.rawMetadata).some(([_, value]) => 
                    String(value).toLowerCase().includes(search.toLowerCase())
                )
            );
        }

        if (contentType) {
            filteredFiles = filteredFiles.filter(file => 
                file.contentType === contentType
            );
        }

        const total = filteredFiles.length;
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const paginatedFiles = filteredFiles.slice(start, end);

        res.json({
            files: paginatedFiles,
            total,
            page,
            rowsPerPage,
            totalPages: Math.ceil(total / rowsPerPage)
        });
    } catch (error) {
        logger.error("Error getting all files:", error);
        res.status(500).json({ error: "Failed to get files" });
    }
};
