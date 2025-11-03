// src/api/summary.js
import axios from "axios";

export const generateSummary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const apiUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

  const res = await axios.post(`${apiUrl}/generate_summary/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data.summary;
};
