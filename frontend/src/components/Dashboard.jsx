import React, { useState, useEffect } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Paper, Grid, Typography, Box, CircularProgress, Divider } from '@mui/material';
import axios from 'axios';

// ChartJS registration
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

// Define API URL
const apiUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

// Standard Chart Colors
const CHART_COLORS = [
    '#00C4CC', // Teal/Cyan (Main for Pie)
    '#FF5722', // Deep Orange
    '#E91E63', // Pink/Magenta
    '#2196F3', // Blue
    '#4CAF50',  // Green
    '#FFC107', // Gold
    '#9C27B0', // Purple
    '#795548', // Brown
];


const Dashboard = ({ history, username, darkMode }) => {
  
  // --- NEW STATE: Global Market Trends ---
  const [topSkills, setTopSkills] = useState([]);
  const [loadingTrends, setLoadingTrends] = useState(true);
  // --- END NEW STATE ---

  // --- Fetch Global Market Trends (NEW useEffect) ---
  useEffect(() => {
    const fetchTrends = async () => {
      setLoadingTrends(true);
      try {
        const response = await axios.get(`${apiUrl}/market_trends`);
        // The API now returns { top_skills: [{ skill: "...", rank: 1 }, ...] }
        setTopSkills(response.data.top_skills || []);
      } catch (error) {
        console.error("Error fetching market trends:", error);
        setTopSkills([]); // Clear on error
      } finally {
        setLoadingTrends(false);
      }
    };
    fetchTrends();
  }, [darkMode]); // Rerun if the theme changes (for text color consistency)
  
  // --- LOCAL THEME VARIABLES ---
  const chartTextColor = darkMode ? '#F0F4F8' : '#333333';
  const tickColor = darkMode ? '#9E9E9E' : '#666666';
  // --- END LOCAL THEME VARIABLES ---

  // --- Process History Data ---
  const topMissingSkills = {};
  const matchScores = [];

  history.forEach(h => {
    (h.missing_skills || []).forEach(skill => {
      // Clean up skill string, assuming normalizeAnalysis already handles the basics
      const cleanSkill = String(skill).split('(')[0].trim();
      if (cleanSkill) {
         topMissingSkills[cleanSkill] = (topMissingSkills[cleanSkill] || 0) + 1;
      }
    });
    matchScores.push(h.skill_match);
  });

  const sortedMissingSkills = Object.entries(topMissingSkills)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const pieData = {
    labels: sortedMissingSkills.map(item => item[0]),
    datasets: [{
      data: sortedMissingSkills.map(item => item[1]),
      backgroundColor: CHART_COLORS, 
      borderColor: darkMode ? '#1E1E1E' : '#FFF5E0', // Match paper color
      borderWidth: 1,
    }],
  };
  
  const barData = {
    labels: history.map(h => h.timestamp.split(' ')[0]).reverse(), 
    datasets: [{
      label: 'Skill Match %',
      data: matchScores.reverse(),
      backgroundColor: CHART_COLORS[0], 
      borderRadius: 6,
    }],
  };
  // -------------------------------------------------------------------

  // --- PIE CHART OPTIONS ---
  const pieOptions = { 
    maintainAspectRatio: false,
    font: { family: 'Poppins' },
    plugins: {
        legend: { labels: { usePointStyle: true, color: chartTextColor, font: { family: 'Poppins' } } },
        title: { display: false }
    }
  };

  // --- BAR CHART OPTIONS ---
  const barOptions = { 
    responsive: true, 
    maintainAspectRatio: false,
    font: { family: 'Poppins' },
    scales: { 
        y: { 
            grid: { color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' },
            ticks: { color: tickColor, font: { family: 'Poppins' }, callback: (value) => `${value}%` },
            max: 100,
            min: 0,
        },
        x: { 
            grid: { display: false },
            ticks: { display: false } 
        }
    },
    plugins: {
        legend: { labels: { usePointStyle: true, color: chartTextColor, font: { family: 'Poppins' } } },
        title: { display: false }
    }
  };

  // --- NEW: Simplified score logic for cleaner visualization ---
  // Ranks 1-10 mapped to visual scores from 100% down to 10%
  const getTrendScore = (rank) => {
    // Rank 1 gets 100, Rank 10 gets 10. Max is 100, Min is 10.
    return Math.max(10, 100 - (rank - 1) * 10);
  }
  // -----------------------------------------------------------

  // --- Global Trends Render Block (Modern Leaderboard Style) ---
  const TrendList = (
    <Box sx={{ p: { xs: 0, md: 2 }, maxHeight: { xs: 550, md: 550 }, overflowY: 'auto' }}> {/* INCREASED maxHeight */}
      {topSkills.length > 0 ? (
        <Grid container spacing={3}>
          {topSkills.map((trend) => {
            const score = getTrendScore(trend.rank);
            const isTop3 = trend.rank <= 3;
            const rankColor = isTop3 ? '#FFC107' : (trend.rank <= 6 ? '#00C4CC' : tickColor);
            
            return (
              <Grid item xs={12} sm={6} key={trend.rank}> {/* Two columns on small screens and up */}
                <Box 
                  sx={{ 
                    p: 2, 
                    bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', 
                    borderRadius: 2, 
                    borderLeft: `3px solid ${rankColor}`, // Left accent line
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2,
                    boxShadow: isTop3 ? '0 0 10px rgba(255, 193, 7, 0.3)' : 'none', // Subtle glow for top 3
                  }}
                >
                  {/* Rank Badge */}
                  <Typography 
                    variant="h5" 
                    fontWeight="extra bold" 
                    sx={{ 
                      color: rankColor, 
                      width: '30px', 
                      textAlign: 'center',
                    }}
                  >
                    #{trend.rank}
                  </Typography>
                  
                  {/* Skill and Score */}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography 
                      variant="body1" 
                      fontWeight="bold" 
                      color="text.primary" 
                      noWrap
                    >
                      {trend.skill}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ color: rankColor, fontWeight: 'medium' }}
                    >
                      {Math.round(score)}% Demand Index
                    </Typography>
                  </Box>
                  
                </Box>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Typography align="center" color="text.secondary">
          Could not fetch global trends. Check API connection.
        </Typography>
      )}
    </Box>
  );
  // -----------------------------------------------------------


  // --- EMPTY STATE (Shows Global Trends First) ---
  if (history.length === 0) {
    return (
      <Grid container spacing={3} justifyContent="center">
        {/* GLOBAL TRENDS CARD (Full Width on Empty State) */}
        <Grid item xs={12} md={8}> 
            <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom fontWeight="bold">Welcome, {username}!</Typography>
                <Typography color="text.secondary" sx={{ mb: 4 }}>
                  Run an analysis in the **Analyze** tab to see your personal stats. Meanwhile, check the global market.
                </Typography>
                <Divider sx={{ mb: 4 }} />
                
                <Typography variant="h6" align="center" gutterBottom fontWeight="bold" sx={{ mt: 2 }}>
                    Top 10 Global Industry Skill Trends
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                   ((Generated by AI Market Analyst))
                </Typography>
                
                {loadingTrends ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 5 }}>
                        <CircularProgress color="primary" />
                        <Typography sx={{ mt: 2 }} color="text.secondary">Fetching Global Trends...</Typography>
                    </Box>
                ) : (
                    TrendList
                )}
            </Paper>
        </Grid>
      </Grid>
    );
  }
  
  // --- FINAL DASHBOARD LAYOUT: Structured Grid for three main cards ---
  return (
    <Grid container spacing={3} justifyContent="center">
        
        {/* --- 1. GLOBAL MARKET TRENDS CARD (Now on Top, Full Width, Larger) --- */}
        <Grid item xs={12}>
            <Paper sx={{ p: 3, height: '100%' }} className="dashboard-card">
                <Typography variant="h6" align="center" gutterBottom fontWeight="bold">
                    Top 10 Global Industry Skill Trends
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                   <strong>(NOT 100 % ACCURATE)</strong>
                </Typography>
                {loadingTrends ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 5 }}>
                        <CircularProgress color="primary" />
                        <Typography sx={{ mt: 2 }} color="text.secondary">Fetching Global Trends...</Typography>
                    </Box>
                ) : (
                    TrendList
                )}
            </Paper>
        </Grid>

        {/* --- 2. PERSONAL PIE CHART CARD (Missing Skills) --- */}
        <Grid item xs={12} md={6}> 
            <Paper sx={{ p: 3, height: '100%' }} className="dashboard-card">
                <Typography variant="h6" align="center" gutterBottom fontWeight="bold">
                    Your Top 5 Missing Skills
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                   (Skills most often missed in your analyses)
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280, p: 1 }}>
                    {sortedMissingSkills.length > 0 ? 
                        <Pie 
                            data={pieData}
                            options={pieOptions}
                            style={{ width: '100%', height: '100%' }}
                        /> : 
                        <Typography align="center" color="text.secondary">You seem to have all skills covered!</Typography>
                    }
                </Box>
            </Paper>
        </Grid>
        
        {/* --- 3. PERSONAL BAR CHART CARD (Score History) --- */}
        <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }} className="dashboard-card">
                <Typography variant="h6" align="center" gutterBottom fontWeight="bold">
                    Your Match Score History
                </Typography>
                 <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                   (Your score trend over time)
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280, p: 1 }}>
                    {matchScores.length > 0 ? 
                        <Bar 
                            data={barData} 
                            options={barOptions}
                            style={{ width: '100%', height: '100%' }}
                        /> : 
                        <Typography align="center" color="text.secondary">No match score data yet.</Typography>
                    }
                </Box>
            </Paper>
        </Grid>
        
    </Grid>
  );
};

export default Dashboard;
