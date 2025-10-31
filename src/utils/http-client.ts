import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

/**
 * Custom error class for HTTP client errors.
 */
export class HttpError extends Error {
  public readonly status?: number;
  public readonly statusText?: string;
  public readonly url?: string;
  public readonly method?: string;
  public readonly isNetworkError: boolean;
  public readonly originalError?: AxiosError;
  public readonly responseData?: any;

  constructor(message: string, config?: AxiosRequestConfig, response?: AxiosResponse, isNetworkError: boolean = false, originalError?: AxiosError) {
    super(message);
    this.name = 'HttpError';
    this.status = response?.status;
    this.statusText = response?.statusText;
    this.url = config?.url;
    this.method = config?.method?.toUpperCase();
    this.isNetworkError = isNetworkError;
    this.originalError = originalError;
    this.responseData = response?.data;

    // Restore prototype chain
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

/**
 * Configuration for HttpClient.
 */
export interface HttpClientConfig {
  baseURL: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: (retryCount: number) => number;
}

/**
 * HTTP client utility for WaspBot-TS, robust to non-JSON and network errors.
 */
export class HttpClient {
  private client: AxiosInstance;

  constructor(config: HttpClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      headers: config.headers,
      timeout: config.timeout || 10000, // Default timeout of 10 seconds
    });

    // Configure axios-retry
    axiosRetry(this.client, {
      retries: config.retries || 3, // Default to 3 retries
      retryDelay: config.retryDelay || axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // Retry on network errors or 5xx status codes
        return axiosRetry.isNetworkError(error) || (error.response?.status && error.response.status >= 500);
      },
    });

    // Add a response interceptor to handle errors and non-JSON responses
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const contentType = response.headers['content-type'];
        if (contentType && !contentType.includes('application/json')) {
          // If not JSON, return raw data as text
          return { ...response, data: response.data.toString() };
        }
        return response;
      },
      (error: AxiosError) => {
        if (error.response) {
          // Server responded with a status other than 2xx
          const message = `Request failed with status ${error.response.status}: ${error.response.statusText}`;
          return Promise.reject(new HttpError(message, error.config, error.response, false, error));
        } else if (error.request) {
          // Request was made but no response was received (e.g., network error)
          const message = `Network error: No response received for ${error.config?.method?.toUpperCase()} ${error.config?.url}`;
          return Promise.reject(new HttpError(message, error.config, undefined, true, error));
        } else {
          // Something happened in setting up the request that triggered an Error
          const message = `Request setup error: ${error.message}`;
          return Promise.reject(new HttpError(message, error.config, undefined, false, error));
        }
      }
    );
  }

  /**
   * Makes an HTTP request.
   * @param config Axios request configuration.
   * @returns A promise that resolves with the response data or rejects with an HttpError.
   */
  public async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }

  /**
   * Performs a GET request.
   * @param url The URL to request.
   * @param config Optional Axios request configuration.
   * @returns A promise that resolves with the response data or rejects with an HttpError.
   */
  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ method: 'GET', url, ...config });
  }

  /**
   * Performs a POST request.
   * @param url The URL to request.
   * @param data The data to send in the request body.
   * @param config Optional Axios request configuration.
   * @returns A promise that resolves with the response data or rejects with an HttpError.
   */
  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ method: 'POST', url, data, ...config });
  }

  /**
   * Performs a PUT request.
   * @param url The URL to request.
   * @param data The data to send in the request body.
   * @param config Optional Axios request configuration.
   * @returns A promise that resolves with the response data or rejects with an HttpError.
   */
  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ method: 'PUT', url, data, ...config });
  }

  /**
   * Performs a DELETE request.
   * @param url The URL to request.
   * @param config Optional Axios request configuration.
   * @returns A promise that resolves with the response data or rejects with an HttpError.
   */
  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ method: 'DELETE', url, ...config });
  }

  /**
   * Performs a PATCH request.
   * @param url The URL to request.
   * @param data The data to send in the request body.
   * @param config Optional Axios request configuration.
   * @returns A promise that resolves with the response data or rejects with an HttpError.
   */
  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ method: 'PATCH', url, data, ...config });
  }
}
