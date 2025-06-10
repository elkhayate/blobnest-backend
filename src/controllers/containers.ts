import { Response } from "express";
import { UserRequest } from "../types";
import { supabaseAdmin } from "../services/supabase";
import { getBlobServiceClient } from "../services/blop";
import logger from "../config/logger";
import { PublicAccessType } from "@azure/storage-blob";
import { createContainerSchema, updateContainerSchema, getContainersQuerySchema } from "../validations/containers";

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function getContainerDetails(containerClient: any) {
    const properties = await containerClient.getProperties();
    const blobs = containerClient.listBlobsFlat();
    let totalSize = 0;
    let blobCount = 0;
    
    for await (const blob of blobs) {
        totalSize += blob.properties.contentLength || 0;
        blobCount++;
    }

    return {
        accountName: containerClient._containerName,
        isHttps: containerClient.isHttps,
        totalSize: formatBytes(totalSize),
        blobCount,
        createdAt: properties.date,
        lastModified: properties.lastModified,
        publicAccess: properties.blobPublicAccess,
        metadata: properties.metadata || {}
    };
}

export const getContainers = async (req: UserRequest, res: Response) => {
    try {
        const queryResult = getContainersQuerySchema.safeParse(req.query);
        if (!queryResult.success) {
            return res.status(400).json({ error: queryResult.error.format() });
        }

        const { search, publicAccess, page, rowsPerPage } = queryResult.data;

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
        const containersList = [];
        
        for await (const container of containersIterator) {
            const containerClient = blobServiceClient.getContainerClient(container.name);
            const containerDetails = await getContainerDetails(containerClient);
            containersList.push(containerDetails);
        }

        let filteredContainers = containersList;
        if (search) {
            filteredContainers = filteredContainers.filter(container => 
                container.accountName.toLowerCase().includes(search.toLowerCase()) ||
                Object.entries(container.metadata).some(([key, value]) => 
                    String(value).toLowerCase().includes(search.toLowerCase())
                )
            );
        }

        if (publicAccess && publicAccess !== 'all') {
            filteredContainers = filteredContainers.filter(container => 
                container.publicAccess === publicAccess
            );
        }

        const total = filteredContainers.length;
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const paginatedContainers = filteredContainers.slice(start, end);

        res.json({
            containers: paginatedContainers,
            total,
            page,
            rowsPerPage,
            totalPages: Math.ceil(total / rowsPerPage)
        });
    } catch (error) {
        logger.error("Error getting containers:", error);
        res.status(500).json({ error: "Failed to get containers" });
    }
};

export const createContainer = async (req: UserRequest, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const validationResult = createContainerSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({ error: validationResult.error.format() });
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
        const containerClient = blobServiceClient.getContainerClient(validationResult.data.name);
        
        const options = {
            access: validationResult.data.publicAccess as PublicAccessType || "container"
        };

        await containerClient.create(options);
        const containerDetails = await getContainerDetails(containerClient);

        res.status(201).json(containerDetails);
    } catch (error) {
        logger.error("Error creating container:", error);
        res.status(500).json({ error: "Failed to create container" });
    }
};

export const updateContainer = async (req: UserRequest, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const validationResult = updateContainerSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({ error: validationResult.error.format() });
        }

        const containerName = req.params.containerName;
        if (!containerName) {
            return res.status(400).json({ error: "Container name is required" });
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

        if (validationResult.data.publicAccess) {
            await containerClient.setAccessPolicy(validationResult.data.publicAccess as PublicAccessType);
        }

        if (validationResult.data.metadata) {
            await containerClient.setMetadata(validationResult.data.metadata);
        }

        const containerDetails = await getContainerDetails(containerClient);
        res.json(containerDetails);
    } catch (error) {
        logger.error("Error updating container:", error);
        res.status(500).json({ error: "Failed to update container" });
    }
};

export const deleteContainer = async (req: UserRequest, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const containerName = req.params.containerName;
        if (!containerName) {
            return res.status(400).json({ error: "Container name is required" });
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

        await containerClient.delete();

        res.json({ message: "Container deleted successfully" });
    } catch (error) {
        logger.error("Error deleting container:", error);
        res.status(500).json({ error: "Failed to delete container" });
    }
};