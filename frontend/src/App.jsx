import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Button,
  CircularProgress,
  Box,
  TextField,
  Paper,
  Switch,
  FormControlLabel,
  CssBaseline,
  Divider,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUploadOutlined";
import HistoryIcon from "@mui/icons-material/History";
import DownloadIcon from "@mui/icons-material/Download";
import axios from "axios";
import ResultCard from "./components/ResultCard";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./App.css";

const App = () => {
  const [file, setFile] = useState(null);
  const [jobDesc, setJobDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [darkMode, setDarkMode] = useState(false);

  // Load previous analyses
  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem("resumeHistory")) || [];
    setHistory(savedHistory);
  }, []);

  // Theme setup
  const theme = createTheme({
    palette: {
      mode: darkMode ? "dark" : "light",
      background: {
        default: darkMode ? "#121212" : "#f4f6f8",
        paper: darkMode ? "#1e1e1e" : "#ffffff",
      },
      primary: { main: "#1976d2" },
      success: { main: "#2e7d32" },
    },
    typography: {
      fontFamily: "Inter, Roboto, sans-serif",
    },
  });

  // File handler
  const handleFileChange = (e) => setFile(e.target.files[0]);

  // Submit handler
  const handleSubmit = async () => {
    if (!file || !jobDesc) return alert("Please upload resume and job description.");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("job_description", jobDesc);

    setLoading(true);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
      const res = await axios.post(`${apiUrl}/analyze_resume/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, "0")}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${now.getFullYear()} ${now.toLocaleTimeString("en-IN")}`;

      const analysis = { ...res.data, timestamp };
      setResult(analysis);

      const updatedHistory = [analysis, ...history].slice(0, 5);
      setHistory(updatedHistory);
      localStorage.setItem("resumeHistory", JSON.stringify(updatedHistory));
    } catch (err) {
      console.error(err);
      alert("Error analyzing resume. Check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  // Structured PDF Download
  const handleDownloadPDF = () => {
    if (!result) return;

    const pdf = new jsPDF("p", "mm", "a4");

    // Header
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("AI Resume Analysis Report", 14, 20);

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    const now = new Date();
    const indianDate = `${String(now.getDate()).padStart(2, "0")}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${now.getFullYear()} ${now.toLocaleTimeString("en-IN")}`;
    pdf.text(`Generated on: ${indianDate}`, 14, 30);

    // Skill Match
    pdf.setFontSize(13);
    pdf.setTextColor(33, 150, 243);
    pdf.text(`Skill Match: ${result.skill_match}%`, 14, 45);
    pdf.setTextColor(0, 0, 0);

    // Missing Skills
    pdf.setFont("helvetica", "bold");
    pdf.text("Missing Skills", 14, 60);
    pdf.setFont("helvetica", "normal");
    autoTable(pdf, {
      startY: 65,
      head: [["Skill"]],
      body: result.missing_skills.length
        ? result.missing_skills.map((s) => [s])
        : [["None"]],
      theme: "grid",
    });

    // Strengths
    const strengthsY = pdf.lastAutoTable.finalY + 10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Strengths", 14, strengthsY);
    pdf.setFont("helvetica", "normal");
    autoTable(pdf, {
      startY: strengthsY + 5,
      head: [["Strength"]],
      body: result.strengths.length ? result.strengths.map((s) => [s]) : [["None"]],
      theme: "grid",
    });

    // Weaknesses
    const weaknessesY = pdf.lastAutoTable.finalY + 10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Weaknesses", 14, weaknessesY);
    pdf.setFont("helvetica", "normal");
    autoTable(pdf, {
      startY: weaknessesY + 5,
      head: [["Weakness"]],
      body: result.weaknesses.length ? result.weaknesses.map((s) => [s]) : [["None"]],
      theme: "grid",
    });

    // Suggestions
    const suggestionsY = pdf.lastAutoTable.finalY + 10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Suggestions", 14, suggestionsY);
    pdf.setFont("helvetica", "normal");
    autoTable(pdf, {
      startY: suggestionsY + 5,
      head: [["Suggestion"]],
      body: result.suggestions.length
        ? result.suggestions.map((s) => [s])
        : [["No suggestions"]],
      theme: "grid",
    });

    // Footer
    const pageHeight = pdf.internal.pageSize.height;
    pdf.setFontSize(10);
    pdf.text(
      "Generated by AI Resume Analyzer | © 2025 Awadh Projects",
      14,
      pageHeight - 10
    );

    pdf.save("AI_Resume_Analysis_Report.pdf");
  };

  // Clear history
  const handleClearHistory = () => {
    if (window.confirm("Clear all past analyses?")) {
      localStorage.removeItem("resumeHistory");
      setHistory([]);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: theme.palette.background.default,
          color: theme.palette.text.primary,
          transition: "background-color 0.3s ease",
          py: 4,
        }}
      >
        <Container maxWidth="md" className="app-container">
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Typography variant="h4" gutterBottom fontWeight="bold">
              AI Resume Analyzer
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={darkMode}
                  onChange={() => setDarkMode(!darkMode)}
                  color="default"
                />
              }
              label={darkMode ? "Dark Mode" : "Light Mode"}
            />
          </Box>

          <Paper className="upload-section" elevation={4} sx={{ p: 3 }}>
            <label htmlFor="file-upload">
              <input
                type="file"
                accept="application/pdf"
                id="file-upload"
                hidden
                onChange={handleFileChange}
              />
              <Button
                variant="contained"
                color="primary"
                component="span"
                startIcon={<CloudUploadIcon />}
              >
                {file ? file.name : "Upload Resume (PDF)"}
              </Button>
            </label>

            <TextField
              label="Job Description"
              multiline
              rows={4}
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              fullWidth
              margin="normal"
            />

            <Button
              variant="contained"
              color="success"
              size="large"
              onClick={handleSubmit}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Analyze"}
            </Button>
          </Paper>

          {result && (
            <Box id="result-card" sx={{ mt: 4, width: "100%" }}>
              <ResultCard result={result} />
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadPDF}
                sx={{ mt: 2 }}
              >
                Download as PDF
              </Button>
            </Box>
          )}

          {history.length > 0 && (
            <Box sx={{ mt: 5, width: "100%" }}>
              <Divider sx={{ mb: 2 }} />
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography
                  variant="h5"
                  gutterBottom
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <HistoryIcon /> Past Analyses
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleClearHistory}
                  size="small"
                >
                  Clear History
                </Button>
              </Box>

              {history.map((h, index) => (
                <Paper
                  key={index}
                  elevation={2}
                  sx={{
                    p: 2,
                    my: 2,
                    borderRadius: 2,
                    bgcolor: theme.palette.background.paper,
                  }}
                >
                  <Typography variant="subtitle1" color="text.secondary">
                    {h.timestamp}
                  </Typography>
                  <Typography variant="body1">
                    Skill Match: <strong>{h.skill_match}%</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Missing Skills: {h.missing_skills.join(", ") || "None"}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default App;
