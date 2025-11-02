import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Divider,
  Chip,
} from "@mui/material";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

const ResultCard = ({ result }) => {
  const {
    skill_match,
    missing_skills = [],
    strengths = [],
    weaknesses = [],
    suggestions = [],
  } = result;

  return (
    <Card
      sx={{
        borderRadius: 4,
        boxShadow: 4,
        p: 3,
        bgcolor: "background.paper",
        color: "text.primary",
        transition: "all 0.3s ease",
      }}
    >
      <CardContent>
        {/* Skill Match Section */}
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          sx={{ mb: 3 }}
        >
          <Box sx={{ width: 150 }}>
            <CircularProgressbar
              value={skill_match}
              text={`${skill_match}%`}
              styles={buildStyles({
                textColor: "var(--text-color, #000)",
                pathColor:
                  skill_match > 75
                    ? "#2e7d32"
                    : skill_match > 50
                    ? "#f9a825"
                    : "#d32f2f",
                trailColor: "rgba(255,255,255,0.1)",
                textSize: "16px",
                pathTransitionDuration: 1.5,
              })}
            />
          </Box>
        </Box>

        <Typography
          variant="h6"
          align="center"
          gutterBottom
          fontWeight="bold"
        >
          Skill Match
        </Typography>

        <Divider sx={{ my: 2 }} />

        {/* Strengths */}
        <Typography variant="h6" gutterBottom>
          ✅ Strengths
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
          {strengths.length > 0 ? (
            strengths.map((item, index) => (
              <Chip
                key={index}
                label={item}
                color="success"
                variant="outlined"
              />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No major strengths listed.
            </Typography>
          )}
        </Box>

        {/* Missing Skills */}
        <Typography variant="h6" gutterBottom>
          ⚠️ Missing Skills
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
          {missing_skills.length > 0 ? (
            missing_skills.map((skill, index) => (
              <Chip key={index} label={skill} color="warning" />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              All skills match well.
            </Typography>
          )}
        </Box>

        {/* Weaknesses */}
        <Typography variant="h6" gutterBottom>
          📉 Weaknesses
        </Typography>
        {weaknesses.length > 0 ? (
          weaknesses.map((w, index) => (
            <Typography
              key={index}
              variant="body2"
              color="text.secondary"
              sx={{ mb: 1 }}
            >
              • {w}
            </Typography>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            None detected.
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Suggestions */}
        <Typography variant="h6" gutterBottom>
          💡 Improvement Suggestions
        </Typography>
        {suggestions.length > 0 ? (
          suggestions.map((s, index) => (
            <Box key={index} sx={{ mb: 1 }}>
              <Typography variant="body2">• {s}</Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, 100 - index * 10)}
                sx={{ height: 6, borderRadius: 2, mt: 0.5 }}
              />
            </Box>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            Resume looks strong.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default ResultCard;
