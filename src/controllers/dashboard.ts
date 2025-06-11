import { Response } from "express";
import { UserRequest } from "../types";
import { supabaseAdmin } from "../services/supabase";
import { getBlobServiceClient } from "../services/blop";
import logger from "../config/logger";
import { getDashboardStatsQuerySchema, getStorageMetricsQuerySchema, getContainerMetricsQuerySchema } from "../validations/dashboard";

interface ActivityEvent {
    timestamp: string;
    container: string;
    blob: string;
    operation: string;
    size: number;
}

function getDateRange(timeRange: 'day' | 'week' | 'month' | 'year'): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    
    switch (timeRange) {
        case 'day':
            start.setDate(start.getDate() - 1);
            break;
        case 'week':
            start.setDate(start.getDate() - 7);
            break;
        case 'month':
            start.setMonth(start.getMonth() - 1);
            break;
        case 'year':
            start.setFullYear(start.getFullYear() - 1);
            break;
    }
    
    return { start, end };
}

export const getDashboardStats = async (req: UserRequest, res: Response) => {
    try {
        const queryResult = getDashboardStatsQuerySchema.safeParse(req.query);
        if (!queryResult.success) {
            return res.status(400).json({ error: queryResult.error.format() });
        }

        const { timeRange } = queryResult.data;
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
        
        const containers = [];
        const containersIterator = blobServiceClient.listContainers();
        for await (const container of containersIterator) {
            if (!container.name.startsWith('$')) { 
                containers.push(container.name);
            }
        }

        let totalFiles = 0;
        let totalSize = 0;
        const fileTypes = new Set<string>();
        const containerStats = [];

        for (const containerName of containers) {
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const blobs = [];
            const blobsIterator = containerClient.listBlobsFlat();
            
            for await (const blob of blobsIterator) {
                totalFiles++;
                totalSize += blob.properties.contentLength || 0;
                const fileExtension = blob.name.split('.').pop()?.toLowerCase();
                if (fileExtension) {
                    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension)) {
                        fileTypes.add('image');
                    } else if (['pdf'].includes(fileExtension)) {
                        fileTypes.add('pdf');
                    } else if (['doc', 'docx'].includes(fileExtension)) {
                        fileTypes.add('document');
                    } else if (['xls', 'xlsx'].includes(fileExtension)) {
                        fileTypes.add('spreadsheet');
                    } else {
                        fileTypes.add(fileExtension);
                    }
                }
                blobs.push(blob);
            }

            containerStats.push({
                name: containerName,
                fileCount: blobs.length,
                totalSize: blobs.reduce((acc, blob) => acc + (blob.properties.contentLength || 0), 0),
                lastModified: blobs.length > 0 ? 
                    new Date(Math.max(...blobs.map(b => new Date(b.properties.lastModified || '').getTime()))) : 
                    null
            });
        }

        const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
        if (usersError) throw usersError;

        const totalUsers = users.users.filter(user => 
            user.user_metadata?.company_id === authUser.user_metadata?.company_id
        ).length;

        let activityMetrics = {
            uploads: 0,
            downloads: 0,
            deletions: 0,
            totalOperations: 0
        };
        let recentActivity: ActivityEvent[] = [];

        try {
            const changeFeedContainer = blobServiceClient.getContainerClient('$blobchangefeed');
            const exists = await changeFeedContainer.exists();
            
            if (exists) {
                const { start, end } = getDateRange(timeRange);
                
                const segmentsIterator = changeFeedContainer.listBlobsFlat({ prefix: 'log/' });
                for await (const segment of segmentsIterator) {
                    if (segment.name.endsWith('.avro')) {
                        const blobClient = changeFeedContainer.getBlobClient(segment.name);
                        const downloadResponse = await blobClient.download();
                        const content = await streamToString(downloadResponse.readableStreamBody);
                        
                        try {
                            const events = JSON.parse(content);
                            if (Array.isArray(events)) {
                                for (const event of events) {
                                    const eventTime = new Date(event.eventTime);
                                    if (eventTime >= start && eventTime <= end) {
                                        recentActivity.push({
                                            timestamp: event.eventTime,
                                            container: event.subject.split('/')[1],
                                            blob: event.subject.split('/').slice(2).join('/'),
                                            operation: event.eventType,
                                            size: event.data.contentLength || 0
                                        });
                                    }
                                }
                            }
                        } catch (error) {
                            logger.error(`Error parsing segment ${segment.name}:`, error);
                        }
                    }
                }

                activityMetrics = {
                    uploads: recentActivity.filter(a => a.operation === 'BlobCreated').length,
                    downloads: recentActivity.filter(a => a.operation === 'BlobRead').length,
                    deletions: recentActivity.filter(a => a.operation === 'BlobDeleted').length,
                    totalOperations: recentActivity.length
                };

                recentActivity = recentActivity
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 10);
            } else {
                logger.warn("Change feed container not found. Activity metrics will be empty.");
            }
        } catch (error) {
            logger.error("Error accessing change feed:", error);
        }

        res.json({
            overview: {
                totalContainers: containers.length,
                totalFiles,
                totalSize,
                totalFileTypes: fileTypes.size,
                fileTypes: Array.from(fileTypes),
                totalUsers,
                lastUpdated: new Date().toISOString()
            },
            containerStats: containerStats.sort((a, b) => 
                (b.lastModified?.getTime() || 0) - (a.lastModified?.getTime() || 0)
            ),
            activityMetrics,
            recentActivity,
            changeFeedEnabled: await blobServiceClient.getContainerClient('$blobchangefeed').exists()
        });
    } catch (error) {
        logger.error("Error getting dashboard stats:", error);
        res.status(500).json({ error: "Failed to get dashboard stats" });
    }
};

export const getStorageMetrics = async (req: UserRequest, res: Response) => {
    try {
        const queryResult = getStorageMetricsQuerySchema.safeParse(req.query);
        if (!queryResult.success) {
            return res.status(400).json({ error: queryResult.error.format() });
        }

        const { timeRange } = queryResult.data;
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
        const { start, end } = getDateRange(timeRange);

        const changeFeedContainer = blobServiceClient.getContainerClient('$blobchangefeed');
        const storageMetrics = {
            dailyUploads: new Map<string, number>(),
            dailyDownloads: new Map<string, number>(),
            dailyDeletions: new Map<string, number>(),
            dailySize: new Map<string, number>()
        };

        try {
            const segmentsIterator = changeFeedContainer.listBlobsFlat({ prefix: 'log/' });
            for await (const segment of segmentsIterator) {
                if (segment.name.endsWith('.avro')) {
                    const blobClient = changeFeedContainer.getBlobClient(segment.name);
                    const downloadResponse = await blobClient.download();
                    const content = await streamToString(downloadResponse.readableStreamBody);
                    
                    try {
                        const events = JSON.parse(content);
                        if (Array.isArray(events)) {
                            for (const event of events) {
                                const eventTime = new Date(event.eventTime);
                                if (eventTime >= start && eventTime <= end) {
                                    const dateKey = eventTime.toISOString().split('T')[0];
                                    const size = event.data.contentLength || 0;

                                    switch (event.eventType) {
                                        case 'BlobCreated':
                                            storageMetrics.dailyUploads.set(
                                                dateKey,
                                                (storageMetrics.dailyUploads.get(dateKey) || 0) + 1
                                            );
                                            storageMetrics.dailySize.set(
                                                dateKey,
                                                (storageMetrics.dailySize.get(dateKey) || 0) + size
                                            );
                                            break;
                                        case 'BlobRead':
                                            storageMetrics.dailyDownloads.set(
                                                dateKey,
                                                (storageMetrics.dailyDownloads.get(dateKey) || 0) + 1
                                            );
                                            break;
                                        case 'BlobDeleted':
                                            storageMetrics.dailyDeletions.set(
                                                dateKey,
                                                (storageMetrics.dailyDeletions.get(dateKey) || 0) + 1
                                            );
                                            storageMetrics.dailySize.set(
                                                dateKey,
                                                (storageMetrics.dailySize.get(dateKey) || 0) - size
                                            );
                                            break;
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        logger.error(`Error parsing segment ${segment.name}:`, error);
                    }
                }
            }
        } catch (error) {
            logger.error("Error accessing change feed:", error);
        }

        const response = {
            uploads: Array.from(storageMetrics.dailyUploads.entries()).map(([date, count]) => ({
                date,
                count
            })),
            downloads: Array.from(storageMetrics.dailyDownloads.entries()).map(([date, count]) => ({
                date,
                count
            })),
            deletions: Array.from(storageMetrics.dailyDeletions.entries()).map(([date, count]) => ({
                date,
                count
            })),
            size: Array.from(storageMetrics.dailySize.entries()).map(([date, size]) => ({
                date,
                size
            }))
        };

        res.json(response);
    } catch (error) {
        logger.error("Error getting storage metrics:", error);
        res.status(500).json({ error: "Failed to get storage metrics" });
    }
};

export const getContainerMetrics = async (req: UserRequest, res: Response) => {
    try {
        const queryResult = getContainerMetricsQuerySchema.safeParse(req.query);
        if (!queryResult.success) {
            return res.status(400).json({ error: queryResult.error.format() });
        }

        const { containerName, timeRange } = queryResult.data;
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
        
        const exists = await containerClient.exists();
        if (!exists) {
            return res.status(404).json({ error: "Container not found" });
        }

        const { start, end } = getDateRange(timeRange);

        const changeFeedContainer = blobServiceClient.getContainerClient('$blobchangefeed');
        const containerMetrics = {
            dailyUploads: new Map<string, number>(),
            dailyDownloads: new Map<string, number>(),
            dailyDeletions: new Map<string, number>(),
            dailySize: new Map<string, number>(),
            fileTypes: new Map<string, number>()
        };

        try {
            const segmentsIterator = changeFeedContainer.listBlobsFlat({ prefix: 'log/' });
            for await (const segment of segmentsIterator) {
                if (segment.name.endsWith('.avro')) {
                    const blobClient = changeFeedContainer.getBlobClient(segment.name);
                    const downloadResponse = await blobClient.download();
                    const content = await streamToString(downloadResponse.readableStreamBody);
                    
                    try {
                        const events = JSON.parse(content);
                        if (Array.isArray(events)) {
                            for (const event of events) {
                                const eventContainer = event.subject.split('/')[1];
                                if (eventContainer === containerName) {
                                    const eventTime = new Date(event.eventTime);
                                    if (eventTime >= start && eventTime <= end) {
                                        const dateKey = eventTime.toISOString().split('T')[0];
                                        const size = event.data.contentLength || 0;
                                        const fileType = event.subject.split('.').pop() || 'unknown';

                                        switch (event.eventType) {
                                            case 'BlobCreated':
                                                containerMetrics.dailyUploads.set(
                                                    dateKey,
                                                    (containerMetrics.dailyUploads.get(dateKey) || 0) + 1
                                                );
                                                containerMetrics.dailySize.set(
                                                    dateKey,
                                                    (containerMetrics.dailySize.get(dateKey) || 0) + size
                                                );
                                                containerMetrics.fileTypes.set(
                                                    fileType,
                                                    (containerMetrics.fileTypes.get(fileType) || 0) + 1
                                                );
                                                break;
                                            case 'BlobRead':
                                                containerMetrics.dailyDownloads.set(
                                                    dateKey,
                                                    (containerMetrics.dailyDownloads.get(dateKey) || 0) + 1
                                                );
                                                break;
                                            case 'BlobDeleted':
                                                containerMetrics.dailyDeletions.set(
                                                    dateKey,
                                                    (containerMetrics.dailyDeletions.get(dateKey) || 0) + 1
                                                );
                                                containerMetrics.dailySize.set(
                                                    dateKey,
                                                    (containerMetrics.dailySize.get(dateKey) || 0) - size
                                                );
                                                break;
                                        }
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        logger.error(`Error parsing segment ${segment.name}:`, error);
                    }
                }
            }
        } catch (error) {
            logger.error("Error accessing change feed:", error);
        }

        const blobs = [];
        const blobsIterator = containerClient.listBlobsFlat();
        for await (const blob of blobsIterator) {
            blobs.push(blob);
        }

        const currentStats = {
            totalFiles: blobs.length,
            totalSize: blobs.reduce((acc, blob) => acc + (blob.properties.contentLength || 0), 0),
            lastModified: blobs.length > 0 ? 
                new Date(Math.max(...blobs.map(b => new Date(b.properties.lastModified || '').getTime()))) : 
                null
        };

        const response = {
            currentStats,
            uploads: Array.from(containerMetrics.dailyUploads.entries()).map(([date, count]) => ({
                date,
                count
            })),
            downloads: Array.from(containerMetrics.dailyDownloads.entries()).map(([date, count]) => ({
                date,
                count
            })),
            deletions: Array.from(containerMetrics.dailyDeletions.entries()).map(([date, count]) => ({
                date,
                count
            })),
            size: Array.from(containerMetrics.dailySize.entries()).map(([date, size]) => ({
                date,
                size
            })),
            fileTypes: Array.from(containerMetrics.fileTypes.entries()).map(([type, count]) => ({
                type,
                count
            }))
        };

        res.json(response);
    } catch (error) {
        logger.error("Error getting container metrics:", error);
        res.status(500).json({ error: "Failed to get container metrics" });
    }
};

async function streamToString(readableStream: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        readableStream.on("data", (data: any) => {
            chunks.push(data.toString());
        });
        readableStream.on("end", () => {
            resolve(chunks.join(""));
        });
        readableStream.on("error", reject);
    });
} 