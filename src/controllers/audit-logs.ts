import { Response } from "express";
import { UserRequest } from "../types";
import { supabaseAdmin } from "../services/supabase";
import { getBlobServiceClient } from "../services/blop";
import logger from "../config/logger";
import { getAuditLogsQuerySchema } from "../validations/audit-logs";

export const getAuditLogs = async (req: UserRequest, res: Response) => {
    try {
        const queryResult = getAuditLogsQuerySchema.safeParse(req.query);
        if (!queryResult.success) {
            return res.status(400).json({ error: queryResult.error.format() });
        }

        const { containerName, operation, page, rowsPerPage } = queryResult.data;

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
        const changeFeedContainer = blobServiceClient.getContainerClient('$blobchangefeed');


        const segments = [];
        const segmentsIterator = changeFeedContainer.listBlobsFlat({ prefix: 'log/' });
        
        for await (const segment of segmentsIterator) {
            if (segment.name.endsWith('.avro')) {
                segments.push(segment);
            }
        }

        if (segments.length === 0) {
            return res.json({
                logs: [],
                total: 0,
                page,
                rowsPerPage,
                totalPages: 0
            });
        }

        segments.sort((a, b) => a.name.localeCompare(b.name));

        const changeFeedEvents = [];
        
        for (const segment of segments) {
            const blobClient = changeFeedContainer.getBlobClient(segment.name);
            const downloadResponse = await blobClient.download();
            const content = await streamToString(downloadResponse.readableStreamBody);
            
            try {
                const events = JSON.parse(content);
                if (!Array.isArray(events)) {
                    continue;
                }
                for (const event of events) {
                    const container = event.subject.split('/')[1];
                    
                    if (!!containerName && container !== containerName) {
                        continue;
                    }

                    if (operation && operation !== 'all' && event.eventType.toLowerCase() !== operation) {
                        continue;
                    }

                    changeFeedEvents.push({
                        timestamp: event.eventTime,
                        container: container,
                        blob: event.subject.split('/').slice(2).join('/'),
                        operation: event.eventType,
                        details: {
                            api: event.data.api,
                            clientRequestId: event.data.clientRequestId,
                            requestId: event.data.requestId,
                            etag: event.data.etag,
                            contentType: event.data.contentType,
                            contentLength: event.data.contentLength,
                            blobType: event.data.blobType,
                            url: event.data.url,
                            sequencer: event.data.sequencer
                        }
                    });
                }
            } catch (error) {
                logger.error(`Error parsing segment ${segment.name}:`, error);
                continue;
            }
        }


        changeFeedEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const total = changeFeedEvents.length;
        const start = (Number(page) - 1) * Number(rowsPerPage);
        const end = start + Number(rowsPerPage);
        const paginatedLogs = changeFeedEvents.slice(start, end);

        res.json({
            logs: paginatedLogs,
            total,
            page,
            rowsPerPage,
            totalPages: Math.ceil(total / Number(rowsPerPage))
        });
    } catch (error) {
        logger.error("Error getting audit logs:", error);
        res.status(500).json({ error: "Failed to get audit logs" });
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