import axios from "axios";
import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { toast } from "sonner";
import { API_URL } from "./Endpoints";

declare module "axios" {
  interface AxiosRequestConfig {
    skipAuth?: boolean;
    skipErrorToast?: boolean;
    meta?: {
      requestId: string;
      startedAt: number;
    };
  }
}

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function requestUrl(config: InternalAxiosRequestConfig) {
  return `${config.baseURL ?? ""}${config.url ?? ""}`;
}

function errorMessage(error: AxiosError<{ message?: string }>) {
  return (
    error.response?.data?.message ||
    error.message ||
    "Something went wrong. Please try again."
  );
}

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.meta = {
    requestId: createRequestId(),
    startedAt: Date.now(),
  };

  if (typeof window !== "undefined" && !config.skipAuth) {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if ((config.method || "get").toLowerCase() === "get") {
    config.headers.set("Cache-Control", "no-cache");
    config.headers.set("Pragma", "no-cache");
  }

  console.info("[API →]", {
    id: config.meta.requestId,
    method: config.method?.toUpperCase(),
    url: requestUrl(config),
    skipAuth: Boolean(config.skipAuth),
  });

  return config;
});

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    const meta = response.config.meta;

    console.info("[API ←]", {
      id: meta?.requestId,
      method: response.config.method?.toUpperCase(),
      url: requestUrl(response.config),
      status: response.status,
      ms: meta ? Date.now() - meta.startedAt : undefined,
    });

    return response;
  },
  (error: AxiosError<{ message?: string }>) => {
    const config = error.config;
    const meta = config?.meta;
    const status = error.response?.status;
    const message = errorMessage(error);

    console.error("[API ✕]", {
      id: meta?.requestId,
      method: config?.method?.toUpperCase(),
      url: config ? requestUrl(config) : undefined,
      status,
      ms: meta ? Date.now() - meta.startedAt : undefined,
      message,
      data: error.response?.data,
    });

    if (!config?.skipErrorToast) {
      if (!error.response) {
        toast.error("Can't reach the server. Check your connection.");
      } else {
        toast.error(message);
      }
    }

    if (status === 401 && typeof window !== "undefined" && !config?.skipAuth) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth-changed"));
    }

    return Promise.reject(error);
  },
);
