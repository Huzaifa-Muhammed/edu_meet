import axios from "axios";
import { getFirebaseAuth } from "@/lib/firebase/client";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  const user = typeof window !== "undefined" ? getFirebaseAuth().currentUser : null;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Unwrap the envelope — return `data` on success, throw on error
api.interceptors.response.use(
  (res) => {
    if (res.data?.ok) return res.data.data;
    return res.data;
  },
  (error) => {
    const msg =
      error.response?.data?.error?.message ?? error.message ?? "Request failed";
    return Promise.reject(new Error(msg));
  },
);

export default api;
