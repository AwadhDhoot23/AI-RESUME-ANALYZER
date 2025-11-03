// src/components/ResultCard.jsx
import React, { useState } from "react"; 
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Divider,
  Chip,
  Button, 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  CircularProgress,
  Paper,
  Grid,
  Stack,
  Tooltip,
} from "@mui/material";
import VisibilityIcon from '@mui/icons-material/Visibility';
import { CircularProgressbar, buildStyles } from "react-circular-progressbar"; 
import "react-circular-progressbar/dist/styles.css"; 
import ReactMarkdown from 'react-markdown'; 
import axios from 'axios';
import { useTheme } from "@mui/material/styles"; 

// --- GET API URL FROM .env.local ---
const apiUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const safeNumber = (v) => {
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  return 0;
};

const toArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    if (v.includes("\n")) return v.split("\n").map((s) => s.trim()).filter(Boolean);
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const ResultCard = ({ result = {}, originalResumeText, originalJobDesc }) => {
  const theme = useTheme(); 
  
  const {
    skill_match,
    missing_skills,
    strengths,
    weaknesses,
    suggestions,
    summary,
    learning_resources,
  } = {
    skill_match: safeNumber(result.skill_match ?? result.skill_match_pct ?? 0),
    missing_skills: toArray(result.missing_skills ?? result.missingSkills),
    strengths: toArray(result.strengths),
    weaknesses: toArray(result.weaknesses),
    suggestions: toArray(result.suggestions),
    summary: result.summary ?? "",
    learning_resources: result.learning_resources ?? {}, 
  };

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [optimizedText, setOptimizedText] = useState("");
  
  // NOTE: showATSPreview state and logic removed as requested by user.

  const score = Math.max(0, Math.min(100, skill_match));
  let level = "Needs Improvement";
  let levelColor = "#d32f2f"; 

  if (score >= 75) {
    level = "Excellent";
    levelColor = "#2e7d32";
  } else if (score >= 50) {
    level = "Moderate";
    levelColor = "#f9a825";
  }

  const circularTextColor = theme.palette.mode === 'dark' ? theme.palette.text.primary : '#333333';

  const handleOptimize = async () => {
    if (!originalResumeText || !originalJobDesc) {
      alert("Error: Original data not found. This is a bug.");
      return;
    }
    
    setIsOptimizing(true);
    setShowOptimizer(true); 
    
    const formData = new FormData();
    formData.append("resume_text", originalResumeText);
    formData.append("job_description", originalJobDesc);
    formData.append("missing_skills", missing_skills.join(", ")); 

    try {
      const res = await axios.post(`${apiUrl}/optimize_resume/`, formData);
      setOptimizedText(res.data.optimized_text);
    } catch (e) {
      console.error(e);
      setOptimizedText("Error: Could not optimize resume text.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCloseOptimizer = () => {
    setShowOptimizer(false);
    setOptimizedText("");
    setIsOptimizing(false);
  };
  
  const learningLinks = Object.entries(learning_resources); 

  const getProviderConfig = (provider) => {
    switch (provider) {
        case 'Coursera':
            return { color: '#0056D2', icon: '🎓' };
        case 'Udemy':
            return { color: '#EC5252', icon: '👨‍💻' };
        case 'YouTube':
        default:
            return { color: '#FF0000', icon: '▶️' };
    }
  };


  return (
    <Card
      sx={{
        borderRadius: 4,
        boxShadow: "0 10px 30px rgba(0,0,0,0.1)", 
        p: { xs: 1, md: 3 }, 
        bgcolor: "background.paper",
        color: "text.primary",
        transition: "all 0.3s ease",
        border: "1px solid var(--glass-border, rgba(0,0,0,0.1))" 
      }}
    >
      <CardContent>
        {/* Skill Match */}
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ mb: 3 }}>
          <Box sx={{ width: 150, mb: 1.5 }}>
            <CircularProgressbar
              value={score}
              text={`${Math.round(score)}%`}
              styles={buildStyles({
                textColor: circularTextColor,
                pathColor: levelColor,
                trailColor: "rgba(139, 148, 158, 0.2)",
                textSize: "16px",
                pathTransitionDuration: 1.5,
              })}
            />
          </Box>
          <Typography
            variant="h5"
            align="center"
            gutterBottom
            sx={{ fontWeight: 'bold', color: levelColor }}
          >
            {level}
          </Typography>
        </Box>

        <Typography variant="h6" align="center" gutterBottom fontWeight="bold">
          Skill Match
        </Typography>
            
        <Divider sx={{ my: 2 }} />

        {/* --- ACTIONS ROW --- */}
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2, gap: 2 }}>
            {/* AI-Optimize Button */}
            <Tooltip title="Rewrite sections of your resume (Experience/Summary) to better match the Job Description and cover missing skills.">
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={handleOptimize}
                  disabled={isOptimizing}
                  startIcon={isOptimizing ? <CircularProgress size={20} color="inherit" /> : "🚀"}
                >
                  {isOptimizing ? "Optimizing..." : "AI-Optimize My Resume"}
                </Button>
            </Tooltip>
        </Box>
        <Divider sx={{ my: 2 }} />
        {/* --- END ACTIONS ROW --- */}


        {/* Summary */}
        {summary && (
          <>
            <Typography variant="h6" align="center" gutterBottom fontWeight="bold">
              📄 Summary
            </Typography>
            <Box sx={{ mb: 2, px: { xs: 1, md: 2 }, whiteSpace: "pre-line", fontSize: "0.9rem", lineHeight: 1.6 }}>
              {summary
                .split("\n")
                .filter((l) => l.trim() !== "")
                .map((line, idx) => (
                  <Typography key={idx} variant="body2" sx={{ display: "block", textAlign: "justify", ml: 3 }}>
                    {line.trim()}
                  </Typography>
                ))}
            </Box>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Strengths */}
        <Typography variant="h6" align="center" gutterBottom fontWeight="bold">
          ✅ Strengths
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 1, mb: 2 }}>
          {strengths.length > 0 ? (
            strengths.map((s, i) => <Chip key={i} label={s} color="success" variant="outlined" />)
          ) : (
            <Typography variant="body2" color="text.secondary">
              No major strengths listed.
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* --- MODIFIED: Missing Skills & Resources (Modernized UI) --- */}
        <Typography 
            variant="h6" 
            align="center" 
            gutterBottom 
            fontWeight="bold" 
            sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}
        >
          <Box component="span" sx={{ color: theme.palette.error.main }}>⚠️</Box> Missing Skills & Learning Resources
        </Typography>
        
        {learningLinks.length > 0 ? (
          <Box sx={{ px: { xs: 1, md: 3 } }}>
            {learningLinks.map(([skill, resourcesDict], skillIndex) => (
              <Paper 
                key={skillIndex} 
                elevation={6} // Increased elevation for a premium feel
                sx={{ 
                    mb: 3, 
                    p: { xs: 2, sm: 3 }, 
                    borderLeft: `4px solid ${theme.palette.error.main}`, // Red error border accent
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'scale(1.01)', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }
                }}
              >
                
                {/* Skill Title */}
                <Typography 
                    variant="subtitle1" 
                    fontWeight="bold" 
                    sx={{ mb: 2, color: theme.palette.error.main }} // Use error color for missing skill
                >
                  Missing Skill: {skill}
                </Typography>
                
                {/* Resource Links GRID */}
                <Stack 
                    direction={{ xs: 'column', sm: 'row' }} 
                    spacing={1} 
                    flexWrap="wrap"
                >
                    {Object.entries(resourcesDict).map(([provider, resource], i) => {
                        const config = getProviderConfig(provider);
                        const link = typeof resource === 'string' ? resource : resource.link;

                        // Check if the resource is the structured YouTube object (for optional future thumbnail use)
                        const isYouTubeStructured = provider === 'YouTube' && typeof resource === 'object' && resource !== null && resource.id;
                        
                        return (
                            <Button
                                key={i}
                                variant="contained"
                                size="small"
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ 
                                    bgcolor: config.color, 
                                    color: 'white',
                                    fontWeight: 'bold', // Make text bold
                                    boxShadow: `0 3px 6px ${config.color}55`, // Subtle shadow matching button color
                                    '&:hover': { 
                                        bgcolor: config.color, 
                                        opacity: 0.9, 
                                        transform: 'translateY(-1px)' 
                                    },
                                    textTransform: 'none',
                                    minWidth: 120,
                                    py: 1,
                                }}
                            >
                                {config.icon} {provider} Link
                            </Button>
                        );
                    })}
                </Stack>
              </Paper>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" align="center">
            All required skills matched well.
          </Typography>
        )}
        {/* --- END OF MODIFICATION --- */}


        {/* Weaknesses */}
        <Typography variant="h6" align="center" gutterBottom fontWeight="bold">
          📉 Weaknesses
        </Typography>
        <Box sx={{ px: 3, mb: 2 }}>
          {weaknesses.length > 0 ? (
            weaknesses.map((w, i) => (
              <Typography key={i} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                • {w}
              </Typography>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary" align="center">
              None detected.
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Suggestions */}
        <Typography variant="h6" align="center" gutterBottom fontWeight="bold">
          💡 Improvement Suggestions
        </Typography>
        <Box sx={{ px: 3 }}>
          {suggestions.length > 0 ? (
            suggestions.map((s, i) => (
              <Box key={i} sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • {s}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(100, 100 - i * 10)} 
                  color="primary" // Use primary accent color
                  sx={{ height: 6, borderRadius: 2 }} 
                />
              </Box>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary" align="center">
              Resume looks strong.
            </Typography>
          )}
        </Box>

        {/* DIALOG (MODAL) - Optimizer */}
        <Dialog open={showOptimizer} onClose={handleCloseOptimizer} fullWidth maxWidth="lg">
          <DialogTitle>AI-Suggested Improvements</DialogTitle>
          <DialogContent>
            {isOptimizing ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 5, minHeight: '300px' }}>
                <Box textAlign="center">
                  <CircularProgress />
                  <Typography sx={{ mt: 2 }}>Generating improvements...</Typography>
                </Box>
              </Box>
            ) : (
              <Grid container spacing={3}>
                
                {/* 1. Original Resume Text */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">Original Resume Text</Typography>
                  <Paper variant="outlined" sx={{ p: 3, bgcolor: "background.default", maxHeight: '60vh', overflowY: 'auto' }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                      {originalResumeText}
                    </Typography>
                  </Paper>
                </Grid>

                {/* 2. AI Optimized Text */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">AI Optimized Text ✨</Typography>
                  <Paper variant="outlined" sx={{ p: 3, bgcolor: "background.default", maxHeight: '60vh', overflowY: 'auto' }}>
                    <ReactMarkdown
                      components={{
                        h1: ({node, ...props}) => <Typography variant="h4" gutterBottom {...props} />,
                        h2: ({node, ...props}) => <Typography variant="h5" gutterBottom {...props} />,
                        h3: ({node, ...props}) => <Typography variant="h6" gutterBottom {...props} />,
                        p: ({node, ...props}) => <Typography variant="body1" paragraph {...props} />,
                        li: ({node, ...props}) => <li style={{ marginBottom: '8px' }}><Typography variant="body1" component="span" {...props} /></li>,
                      }}
                    >
                      {optimizedText}
                    </ReactMarkdown>
                  </Paper>
                </Grid>
              </Grid>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ResultCard;