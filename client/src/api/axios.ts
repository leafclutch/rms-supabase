import axios from "axios";

export const BASE_URL = import.meta.env.VITE_API_URL || "https://api.dhakalnishan.com.np/";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});


api.interceptors.request.use((config) => {
  const auth = localStorage.getItem("authUser");

  if (auth) {
    const { token } = JSON.parse(auth);
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
