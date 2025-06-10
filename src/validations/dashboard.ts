import { z } from "zod";

export const getDashboardStatsQuerySchema = z.object({
    timeRange: z.enum(['day', 'week', 'month', 'year']).default('week'),
});

export const getStorageMetricsQuerySchema = z.object({
    timeRange: z.enum(['day', 'week', 'month', 'year']).default('week'),
});

export const getContainerMetricsQuerySchema = z.object({
    containerName: z.string(),
    timeRange: z.enum(['day', 'week', 'month', 'year']).default('week'),
}); 