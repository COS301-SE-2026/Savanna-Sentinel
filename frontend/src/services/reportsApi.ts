import { api } from "./api";

export type ReportType = "incident" | "sighting";
export type SeverityLevel = "low" | "medium" | "high";
export type SyncStatus = "offline" | "pending" | "synced";

export interface LocationResponse {
  type: string;
  coordinates: number[];
}

export interface LocationLatLon {
  lat: number;
  lon: number;
}

export interface ReportResponse {
  id: string;
  submitted_by: string;
  route_id?: string | null;
  report_type: string;
  description: string;
  location: LocationResponse;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  images: string[];
}

export interface ReportListItem {
  report_id: string;
  report_type: string;
  location: LocationLatLon;
  occurred_at: string;
  description: string;
  incident_type?: string | null;
  severity?: string | null;
  species?: string | null;
  count?: number | null;
  images: string[];
  route_id?: string | null;
  sync_status: string;
  submitted_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface ReportListResponse {
  total: number;
  page: number;
  page_size: number;
  results: ReportListItem[];
}

export interface ReportSubmitResponse {
  report_id: string;
  report_type: string;
  status: string;
  submitted_by: string;
  created_at: string;
}

// Request Payload
export interface ReportCreate {
  report_type: ReportType;
  location: LocationLatLon;
  occurred_at: string;
  description: string;
  incident_type?: string;
  severity?: SeverityLevel;
  species?: string;
  count?: number;
  images?: string[];
  route_id?: string;
  sync_status?: SyncStatus;
}

export interface ReportUpdate {
  description?: string;
  location?: LocationLatLon;
  occurred_at?: string;
  images?: string[];
  incident_type?: string;
  severity?: SeverityLevel;
  species?: string;
  count?: number;
}

// Query Parameters GET
export interface ListReportsQueryParams {
  report_type?: ReportType;
  severity?: SeverityLevel;
  from?: string;
  to?: string;
  sync_status?: SyncStatus;
  page?: number;
  page_size?: number;
}