// src/App.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  // Removed: Container
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  LinearProgress,
  Grid,
  Drawer,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Select,
  MenuItem,
  Tooltip,
  Rating,
  Radio, // <-- NEW
  RadioGroup, // <-- NEW
  FormControl, // <-- NEW
  FormLabel // <-- NEW
} from "@mui/material";

import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'; // NEW ICON for collapsing
import DashboardIcon from '@mui/icons-material/Dashboard';
import TroubleshootIcon from '@mui/icons-material/Troubleshoot'; // (Analyze)
import HistoryIcon from "@mui/icons-material/History";
import SettingsIcon from '@mui/icons-material/Settings';
import DownloadIcon from "@mui/icons-material/Download";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'; // NEW ICON for scroll down
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep"; // NEW ICON for clearing history
import LockOpenIcon from '@mui/icons-material/LockOpen'; // NEW ICON for password reset
import TabIcon from '@mui/icons-material/Tab'; // NEW ICON for default tab
import VisibilityIcon from '@mui/icons-material/Visibility'; // NEW ICON for history preview
import BadgeIcon from '@mui/icons-material/Badge'; // NEW ICON for changing username
import FeedbackIcon from '@mui/icons-material/Feedback'; // NEW ICON for Feedback tab
// -------------------
import axios from "axios";
import ResultCard from "./components/ResultCard";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { motion } from "framer-motion";
import "./App.css";
import Logo from './logo.svg'; // <--- LOGO IMPORT

// --- MODIFIED FIREBASE IMPORTS: Removed Storage ---
import { auth, db } from "./firebaseConfig";
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

import {
  createUserWithEmailAndPassword, // KEPT: Used in handleSignup
  signInWithEmailAndPassword, // KEPT: Used in handleLogin
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "firebase/auth";
import {
  collection, addDoc, query, where, getDocs,
  orderBy, deleteDoc,
} from "firebase/firestore";
import { useSnackbar } from 'notistack';
import Dashboard from './components/Dashboard';
// -------------------------------------

/**
 * Utility: normalizeAnalysis (Unchanged)
 */
const smoothScrollToTop = (element, duration = 1000) => {
  if (!element) return;
  
  const startPosition = element.scrollTop;
  const startTime = performance.now();
  
  const easeInOutQuad = (t) => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  };
  
  const scroll = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = easeInOutQuad(progress);
    
    element.scrollTop = startPosition * (1 - ease);
    
    if (progress < 1) {
      requestAnimationFrame(scroll);
    }
  };
  
  requestAnimationFrame(scroll);
};

const normalizeAnalysis = (raw = {}) => {
  const skill_match =
    Number(raw.skill_match ?? raw.skill_match_pct ?? raw.skillMatch ?? 0) || 0;

  const arrify = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      if (v.includes("\n"))
        return v.split("\n").map((s) => s.trim()).filter(Boolean);
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };

  return {
    ...raw,
    skill_match,
    missing_skills: arrify(raw.missing_skills ?? raw.missingSkills),
    strengths: arrify(raw.strengths),
    weaknesses: arrify(raw.weaknesses),
    suggestions: arrify(raw.suggestions),
    summary: raw.summary ?? "",
    timestamp: raw.timestamp ?? "",
    resume_filename: raw.resume_filename ?? "N/A",
    job_description: raw.job_description ?? "N/A",
  };
};

// --- DRAWER WIDTHS ---
const expandedDrawerWidth = 280;
const miniDrawerWidth = 72 // NEW: Collapsed width
// ---------------------

const apiUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

// --- NEW UTILITY FUNCTION: Centralize Firestore save logic (READY FOR TASK 4) ---
const saveAnalysisToFirestore = async (analysisResultData, jobDesc, file, user, db, enqueueSnackbar) => {
    if (!user) return;

    try {
        await addDoc(collection(db, "history"), {
          ...analysisResultData,
          job_description: jobDesc,
          resume_filename: file.name,
          uid: user.uid,
          timestamp: serverTimestamp()
        });
        
        enqueueSnackbar('Analysis complete and saved!', { variant: 'success' });

    } catch (dbError) {
        console.error("Firestore save error: ", dbError);
        enqueueSnackbar("Analysis complete, but failed to save to cloud.", { variant: 'warning' });
    }
};
// -----------------------------------------------------------------------------


const App = () => {
  const { enqueueSnackbar } = useSnackbar();
  
  const authFormRef = useRef(null);
  
  // --- NEW REF for main content scrolling ---
  const mainContentRef = useRef(null);
  
  const [file, setFile] = useState(null);
  const [jobDesc, setJobDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentResumeText, setCurrentResumeText] = useState("");

  const [themeMode, setThemeMode] = useState( // UPDATED STATE NAME
    localStorage.getItem("themeMode") || 'dark'
  );
  
  // NOTE: Tab index 4 is now reserved for the Feedback tab
  const [tabIndex, setTabIndex] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // --- NEW: State for desktop sidebar expansion ---
  const [drawerOpen, setDrawerOpen] = useState(true);

  const [user, setUser] = useState(null);
  const [showSignup, setShowSignup] = useState(false);
  const [email, setEmail] = useState(""); // Stores email used for auth
  const [password, setPassword] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);

  // --- USERNAME / DISPLAY NAME STATE ---
  const [displayName, setDisplayName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState(""); // FIX: Corrected syntax
  const [changeDisplayNameOpen, setChangeDisplayNameOpen] = useState(false);

  // --- NEW STATES FOR HISTORY MANAGEMENT ---
  const [historySearch, setHistorySearch] = useState('');
  const [historySortBy, setHistorySortBy] = useState('timestamp'); // 'timestamp' or 'skill_match'
  const [historyScoreFilter, setHistoryScoreFilter] = useState('all'); // 'all', 'excellent', 'moderate', 'needs_improvement'
  // ------------------------------------------
  
  // --- NEW STATE: Control which section is visible on the unauthorized screen ---
  const [showAuthSection, setShowAuthSection] = useState(false);

  // --- NEW STATES FOR UNIQUE SETTINGS (Replacing previous unique settings) ---
  const [defaultTab, setDefaultTab] = useState(localStorage.getItem('defaultTab') || '0'); // '0' for Dashboard, '1' for Analyze
  const [showHistoryPreview, setShowHistoryPreview] = useState(localStorage.getItem('showHistoryPreview') === 'true' || true); // Toggle preview visibility
  
  // --- NEW STATE FOR ONBOARDING ---
  const [showOnboarding, setShowOnboarding] = useState(false);

  // --- FEEDBACK TAB STATES ---
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState('Suggestion'); // 'Bug', 'Suggestion', 'Rating'

  // --- NEW STATES FOR PDF OPTIONS ---
  const [pdfOptionsOpen, setPdfOptionsOpen] = useState(false);
  const [pdfTheme, setPdfTheme] = useState('light'); // 'light' or 'dark'


  // Auth Handlers defined in App scope (FIXES NO-UNDEF ERROR)
  const handleLogin = () => {
    signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        enqueueSnackbar('Login Successful!', { variant: 'success' });
        const storedDefaultTab = localStorage.getItem('defaultTab');
        setTabIndex(parseInt(storedDefaultTab) || 0);
      })
      .catch(() => {
        enqueueSnackbar("Invalid credentials.", { variant: 'error' });
      });
  };

  const handleSignup = () => {
    if (!email || !password || !displayName) {
      enqueueSnackbar("Please enter email, desired username, and password.", { variant: 'warning' });
      return;
    }
    if (password.length < 6) {
      enqueueSnackbar("Password must be at least 6 characters.", { variant: 'warning' });
      return;
    }

    createUserWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        const uid = userCredential.user.uid;
        const userDocRef = doc(db, "users", uid);
        await setDoc(userDocRef, {
            email: email,
            displayName: displayName,
            createdAt: serverTimestamp(),
            onboardingComplete: false,
        });
        
        enqueueSnackbar("Signup successful! Please log in.", { variant: 'success' });
        setShowSignup(false);
        setPassword("");
        // No need to call handleLogin here, auth listener will catch the change upon successful login attempt
      })
      .catch((error) => {
        enqueueSnackbar(error.message, { variant: 'error' });
      });
  };
  // --- END AUTH HANDLERS ---


  // Fetch user profile data (REVISED: Fetching displayName)
  // --- FIXED: Refactored to not depend on stale `user` state ---
  const fetchUserProfile = useCallback(async (uid, email) => {
    try {
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
         const data = userDoc.data();
         setDisplayName(data.displayName || data.email || "User");
         
         // --- ONBOARDING CHECK ---
         if (data.onboardingComplete !== true) {
            setShowOnboarding(true);
         }
         // ------------------------

      } else {
         // Create the user document if it doesn't exist (initial login)
         const initialName = email || "User";
         
         // FIX: Check if uid exists before attempting to setDoc
         if (uid) {
            await setDoc(userDocRef, {
                email: email, // <-- Use email from auth
                displayName: initialName, // Default to email as display name
                createdAt: serverTimestamp(),
                onboardingComplete: false, // Set initial onboarding status
            });
         }
         setDisplayName(initialName);
         setShowOnboarding(true); // Show onboarding for brand new users
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setDisplayName("User");
    }
  }, []); // <-- FIXED: Removed [user] dependency, this is now stable
  // -----------------------------------------------------------------

  // Fetch history from Firestore
  const fetchHistory = useCallback(async (uid) => {
    try {
      const q = query(
        collection(db, "history"),
        where("uid", "==", uid),
        orderBy("timestamp", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const userHistory = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        userHistory.push(normalizeAnalysis({
          id: doc.id, // Include doc ID for deletion
          ...data,
          timestamp: data.timestamp ? data.timestamp.toDate().toLocaleString("en-IN") : "No date",
        }));
      });
      setHistory(userHistory);
    } catch (e) {
      console.error("Error fetching history: ", e);
      enqueueSnackbar("Could not fetch cloud history.", { variant: 'error' });
    }
  }, [enqueueSnackbar]); // Dependency on `enqueueSnackbar`

  // Auth listener (REVISED: Uses setEmail and sets displayName on login)
  useEffect(() => {
    // FIX: Apply the correct CSS class based on themeMode
    document.body.className = `${themeMode}-mode`;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // IMPORTANT: Only set the default tab if the user wasn't previously logged in (user === null)
        const initialLoad = user === null;
        
        setUser(currentUser);
        // We keep track of the display name separate from the auth email
        setDisplayName(currentUser.displayName || currentUser.email);
        fetchHistory(currentUser.uid);
        // --- FIXED: Pass email to fetchUserProfile ---
        fetchUserProfile(currentUser.uid, currentUser.email);
        
        // --- NEW: Apply default tab setting ONLY ON INITIAL LOAD ---
        const storedDefaultTab = localStorage.getItem('defaultTab');
        if (storedDefaultTab !== null && initialLoad) {
            setTabIndex(parseInt(storedDefaultTab));
        }
        // -----------------------------------------------------------
        
      } else {
        setUser(null);
        setHistory([]);
        setDisplayName(""); // Clear display name on logout
        setShowOnboarding(false); // Hide onboarding if logged out
      }
    });
    return () => unsubscribe();
  }, [themeMode, fetchHistory, fetchUserProfile]); // Fixed: Removed `handleLogin` and added missing dependencies

  // --- NEW: Scroll to top on tab change ---
  useEffect(() => {
    if (mainContentRef.current) {
      // Use the smooth scroll utility instead of instant scroll
      smoothScrollToTop(mainContentRef.current, 400); // 400ms animation
    }
  }, [tabIndex]);
 
  // ----------------------------------------

  // --- NEW: ONBOARDING COMPLETION HANDLER ---
  const handleOnboardingComplete = async (startTab = 0) => {
    if (!user) return;

    try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { onboardingComplete: true });
        setShowOnboarding(false);
        setTabIndex(startTab); // Optionally switch to the Analyze tab (index 1)
        enqueueSnackbar('Welcome aboard! Let’s get started.', { variant: 'success' });
    } catch (error) {
        console.error("Error setting onboarding complete status:", error);
        setShowOnboarding(false); // Close anyway if update fails
    }
  };

  // --- NEW: FEEDBACK SUBMISSION LOGIC ---
  const handleFeedbackSubmit = async () => {
    if (!user) {
        enqueueSnackbar("Please log in to submit feedback.", { variant: 'warning' });
        return;
    }
    if (!feedbackText.trim()) {
        enqueueSnackbar("Please enter your feedback.", { variant: 'warning' });
        return;
    }

    try {
        await addDoc(collection(db, "feedback"), {
            uid: user.uid,
            displayName: displayName,
            type: feedbackType,
            rating: feedbackRating,
            text: feedbackText,
            timestamp: serverTimestamp()
        });
        
        enqueueSnackbar(`Thank you for your ${feedbackType}! We value your input.`, { variant: 'success' });
        setFeedbackText("");
        setFeedbackRating(5);
        setFeedbackType('Suggestion');
    } catch (error) {
        console.error("Error submitting feedback:", error);
        enqueueSnackbar("Failed to submit feedback to the cloud.", { variant: 'error' });
    }
  };


  // --- USERNAME HANDLER ---
  const handleChangeDisplayName = async () => {
      if (!user) return;
      const cleanName = newDisplayName.trim();
      if (cleanName.length < 3) {
          enqueueSnackbar("Display name must be at least 3 characters.", { variant: 'warning' });
          return;
      }
      
      try {
          const userDocRef = doc(db, "users", user.uid);
          await updateDoc(userDocRef, { displayName: cleanName });
          setDisplayName(cleanName);
          setChangeDisplayNameOpen(false);
          enqueueSnackbar('Display name updated successfully!', { variant: 'success' });
      } catch (error) {
          console.error("Error updating display name:", error);
          enqueueSnackbar('Failed to update display name.', { variant: 'error' });
      }
  };


  // --- NEW HANDLER: DELETE SINGLE HISTORY ITEM (unchanged logic) ---
  const handleDeleteHistoryItem = async (id, filename) => {
      // Note: Using window.prompt instead of confirm due to sandbox restrictions
      const confirmation = window.prompt(`Type 'DELETE' to confirm deleting analysis for "${filename}":`);
      if (confirmation !== 'DELETE') {
          enqueueSnackbar("Deletion cancelled.", { variant: 'info' });
          return;
      }

      try {
          const docRef = doc(db, "history", id);
          await deleteDoc(docRef);

          // Update local state by filtering out the deleted item
          setHistory(prevHistory => prevHistory.filter(h => h.id !== id));
          enqueueSnackbar(`Successfully deleted analysis for "${filename}".`, { variant: 'success' });

      } catch (e) {
          console.error("Error deleting history item:", e);
          enqueueSnackbar("Failed to delete history item.", { variant: 'error' });
      }
  };


  // --- LOGOUT HANDLER ---
  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        enqueueSnackbar('Logged out.', { variant: 'info' });
      })
      .catch((error) => enqueueSnackbar("Error logging out.", { variant: 'error' }));
  };

  const handleForgotPassword = () => {
    if (!resetUsername) {
      enqueueSnackbar("Please enter your email address.", { variant: 'warning' });
      return;
    }
    sendPasswordResetEmail(auth, resetUsername)
      .then(() => {
        enqueueSnackbar('Password reset email sent! Check your inbox.', { variant: 'success' });
        setForgotOpen(false);
        setResetUsername("");
      })
      .catch((error) => {
        if (error.code === 'auth/user-not-found') {
          enqueueSnackbar('Error: No user found with that email.', { variant: 'error' });
        } else {
          enqueueSnackbar(error.message, { variant: 'error' });
        }
      });
  };
  // --- END AUTH HANDLERS ---
  
  // --- NEW: Handle clearing cloud history (unchanged logic) ---
  const handleClearCloudHistory = async () => {
    if (!user) {
        enqueueSnackbar("You must be logged in to clear history.", { variant: 'warning' });
        return;
    }

    // A simple, visual way to confirm without using the forbidden `confirm()`
    const confirmation = window.prompt("Type 'YES' to confirm deleting ALL cloud history:");
    if (confirmation !== 'YES') {
        enqueueSnackbar("Deletion cancelled.", { variant: 'info' });
        return;
    }

    try {
        const q = query(collection(db, "history"), where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        
        let deletePromises = [];
        querySnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        
        await Promise.all(deletePromises);
        
        setHistory([]); // Clear local state immediately
        enqueueSnackbar('Successfully deleted all cloud history!', { variant: 'success' });

    } catch (e) {
        console.error("Error clearing cloud history:", e);
        enqueueSnackbar("Failed to clear cloud history.", { variant: 'error' });
    }
  };


  const handleHistoryClick = (historyItem) => {
    setSelectedHistory(historyItem);
    setHistoryModalOpen(true);
  };
  
  const handleHistoryModalClose = () => {
    setHistoryModalOpen(false);
    setSelectedHistory(null);
  }

  // Placeholder function that now redirects to Settings
  const openProfile = () => { setTabIndex(3); };
  
  const handleFileChange = (e) => setFile(e.target.files[0]);

  // --- NEW HANDLER for desktop sidebar toggle ---
  const handleDrawerDesktopToggle = () => {
    setDrawerOpen(!drawerOpen);
  };
  // ---------------------------------------------

  // --- NEW HANDLERS for new settings ---
  const handleDefaultTabChange = (event) => {
    const newVal = event.target.value;
    setDefaultTab(newVal);
    localStorage.setItem('defaultTab', newVal);
    enqueueSnackbar(`Default starting tab set to ${newVal === '0' ? 'Dashboard' : 'Analyze'}.`, { variant: 'info' });
  };
  
  const handleShowHistoryPreviewChange = (event) => {
    const isChecked = event.target.checked;
    setShowHistoryPreview(isChecked);
    localStorage.setItem('showHistoryPreview', isChecked);
    enqueueSnackbar(`History previews are now ${isChecked ? 'enabled' : 'disabled'}.`, { variant: 'info' });
  };

  // --- NEW HANDLER FOR THEME MODE SELECTION ---
  const handleThemeModeChange = (event) => {
    const newMode = event.target.value;
    setThemeMode(newMode);
    localStorage.setItem('themeMode', newMode);
    enqueueSnackbar(`Theme set to ${newMode}.`, { variant: 'info' });
  }
  
  // --- UPDATED theme object (Adding Sepia Mode) ---
  const theme = createTheme({
    palette: {
      // Use Light mode palette for both 'light' and 'sepia' base modes, with background override below
      mode: themeMode === 'dark' ? "dark" : "light",
      background: {
        default: themeMode === 'dark' ? "#121212" : (themeMode === 'sepia' ? "#FBF0D9" : "#f4f6f8"),
        paper: themeMode === 'dark' ? "#1E1E1E" : (themeMode === 'sepia' ? "#FFF5E0" : "#ffffff"),
      },
      // Override text color for Sepia mode to be dark gray
      text: {
        primary: themeMode === 'sepia' ? "#4B371C" : (themeMode === 'dark' ? "#F0F4F8" : "#000000"),
        secondary: themeMode === 'sepia' ? "#79664D" : (themeMode === 'dark' ? "#9E9E9E" : "#666666"),
      },
      primary: { main: "#FFC107" }, // Primary Accent is GOLD/AMBER
      success: { main: "#2e7d32" },
      error: { main: "#d32f2f" },
    },
    typography: { fontFamily: "'Poppins', 'Inter', 'Roboto', 'sans-serif'" },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            // Ensures the Sepia background color is applied to all Paper elements
            backgroundColor: themeMode === 'sepia' ? "#FFF5E0" : undefined,
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRadius: 0,
          }
        }
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
          }
        }
      }
    }
  });

  // persist theme toggle (DOES NOT CHANGE TAB INDEX)
  const toggleTheme = (val) => {
    const newMode = val ? 'dark' : 'light';
    setThemeMode(newMode);
    localStorage.setItem("themeMode", newMode);
  };


  // handleSubmit (Refactored logic using the new utility function)
  const handleSubmit = async () => {
    if (!file || !jobDesc) {
      enqueueSnackbar("Please upload resume and job description.", { variant: 'warning' });
      return;
    }
    if (!user) {
      enqueueSnackbar("Please log in to analyze a resume.", { variant: 'warning' });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("job_description", jobDesc);

    setLoading(true);
    setResult(null);
    setCurrentResumeText("");
    
    let analysisResultData;

    try {
      const res = await axios.post(`${apiUrl}/analyze_resume/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, "0")}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${now.getFullYear()} ${now.toLocaleTimeString("en-IN")}`;

      const normalized = normalizeAnalysis({
        ...res.data,
        timestamp,
      });

      analysisResultData = res.data;
      setCurrentResumeText(res.data.resume_text);
      setResult(normalized);
      
    } catch (e) {
      console.error(e);
      const errorMsg = e.response?.data?.detail || "Error analyzing resume. Check backend connection.";
      enqueueSnackbar(errorMsg, { variant: 'error' });
      setLoading(false);
      return;
    }

    // --- REFACTORED: Use centralized utility function ---
    if (analysisResultData && user) {
        await saveAnalysisToFirestore(analysisResultData, jobDesc, file, user, db, enqueueSnackbar);
        await fetchHistory(user.uid);
    }
    // --------------------------------------------------
    
    setLoading(false);
  };


  // handleDownloadPDF (Updated logic for detailed PDF with THEMES)
  const handleDownloadPDF = () => {
    if (!result) return;

    // --- NEW: Theme Definitions ---
    const isDark = pdfTheme === 'dark';
    const bgColor = isDark ? '#1E1E1E' : '#FFFFFF';
    const textColor = isDark ? '#F0F4F8' : '#000000';
    const primaryColor = isDark ? '#FFC107' : '#1976D2'; // Gold for dark, Blue for light
    const tableTheme = isDark ? 'striped' : 'grid';
    const tableHeadColor = isDark ? primaryColor : primaryColor;
    const tableHeadTextColor = isDark ? '#000000' : '#FFFFFF';
    const tableSubtleBg = isDark ? '#2a2a2a' : '#f9f9f9';
    // --- End Theme Definitions ---

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      
      // --- NEW: Draw Background ---
      pdf.setFillColor(bgColor);
      pdf.rect(0, 0, pdf.internal.pageSize.width, pdf.internal.pageSize.height, 'F');
      // ---

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(textColor); // <-- Use theme color
      pdf.text("AI Resume Analysis Report", 14, 20);
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(textColor); // <-- Use theme color
      const now = new Date();
      const indianDate = `${String(now.getDate()).padStart(2, "0")}-${String(
        now.getMonth() + 1
      )}-${now.getFullYear()} ${now.toLocaleTimeString("en-IN")}`;
      pdf.text(`Generated on: ${indianDate}`, 14, 30);
      
      pdf.setFontSize(13);
      pdf.setTextColor(primaryColor); // <-- Use theme color (accent)
      pdf.text(`Skill Match: ${result.skill_match || 0}%`, 14, 40);
      
      pdf.setTextColor(textColor); // <-- Reset to theme color
      pdf.setFont("helvetica", "bold");
      pdf.text("Summary", 14, 50);
      
      pdf.setFont("helvetica", "normal");
      const summaryStartY = 56;
      const wrappedSummary = pdf.splitTextToSize(result.summary || "No summary available.", 180);
      pdf.text(wrappedSummary, 14, summaryStartY);
      
      let currentY = summaryStartY + wrappedSummary.length * 6;
      
      const missing_skills = Array.isArray(result.missing_skills) ? result.missing_skills : [];
      const strengths = Array.isArray(result.strengths) ? result.strengths : [];
      const weaknesses = Array.isArray(result.weaknesses) ? result.weaknesses : [];
      const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
      
      // --- NEW: Define shared table styles ---
      const tableStyles = {
        theme: tableTheme,
        styles: {
          fontSize: 10,
          textColor: textColor,
          fillColor: bgColor // Ensure cells have correct bg
        },
        headStyles: {
          fillColor: tableHeadColor,
          textColor: tableHeadTextColor,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: tableSubtleBg
        },
      };
      // ---

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(textColor); // <-- Use theme color
      pdf.text("Missing Skills", 14, currentY + 8);
      pdf.setFont("helvetica", "normal");
      autoTable(pdf, {
        startY: currentY + 12,
        head: [["Skill"]],
        body: missing_skills.length > 0 ? missing_skills.map((s) => [s]) : [["None"]],
        ...tableStyles // <-- Use shared styles
      });

      const strengthsY = pdf.lastAutoTable ? pdf.lastAutoTable.finalY + 8 : currentY + 12;
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(textColor); // <-- Use theme color
      pdf.text("Strengths", 14, strengthsY);
      pdf.setFont("helvetica", "normal");
      autoTable(pdf, {
        startY: strengthsY + 6,
        head: [["Strength"]],
        body: strengths.length > 0 ? strengths.map((s) => [s]) : [["None"]],
        ...tableStyles // <-- Use shared styles
      });

      const weaknessesY = pdf.lastAutoTable ? pdf.lastAutoTable.finalY + 8 : strengthsY + 6;
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(textColor); // <-- Use theme color
      pdf.text("Weaknesses", 14, weaknessesY);
      pdf.setFont("helvetica", "normal");
      autoTable(pdf, {
        startY: weaknessesY + 6,
        head: [["Weakness"]],
        body: weaknesses.length > 0 ? weaknesses.map((w) => [w]) : [["None"]],
        ...tableStyles // <-- Use shared styles
      });

      const suggestionsY = pdf.lastAutoTable ? pdf.lastAutoTable.finalY + 8 : weaknessesY + 6;
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(textColor); // <-- Use theme color
      pdf.text("Suggestions", 14, suggestionsY);
      pdf.setFont("helvetica", "normal");
      autoTable(pdf, {
        startY: suggestionsY + 6,
        head: [["Suggestion"]],
        body: suggestions.length > 0 ? suggestions.map((s) => [s]) : [["No suggestions"]],
        ...tableStyles // <-- Use shared styles
      });

      const pageHeight = pdf.internal.pageSize.height;
      pdf.setFontSize(10);
      pdf.setTextColor(textColor); // <-- Use theme color
      pdf.text("Generated by RESUMIFYY   |   © 2025 Awadh Projects", 12, pageHeight - 10);
      pdf.save("AI_Resume_Analysis_Report.pdf");
      enqueueSnackbar('Downloading PDF...', { variant: 'info' });
    } catch (e) {
      console.error("PDF generation failed:", e);
      enqueueSnackbar('Error generating PDF.', { variant: 'error' });
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // --- FIXED: Definition moved before use ---
  // Consider mobile drawer open as "expanded" so footer and text show when temporary drawer is opened on small screens
  const effectiveDrawerOpen = drawerOpen || mobileOpen;
  
  // --- Sidebar Content (UPDATED HEADER WITH LOGO AND APP NAME) ---
  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 1 }}>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: effectiveDrawerOpen ? 'space-between' : 'center', p: 2, pt: 3, pb: 1 }}>
        {effectiveDrawerOpen && (
          <Box display="flex" alignItems="center">
             <Box sx={{ width: 32, height: 32, mr: 1 }} className="sidebar-logo">
                <img
                    src={Logo}
                    alt="Logo"
                    style={{ height: '100%', width: 'auto', display: 'block' }}
                />
            </Box>
            <Typography variant="h5" fontWeight="bold">
                RESUMIFYY
            </Typography>
          </Box>
        )}
        <IconButton onClick={handleDrawerDesktopToggle} edge="start" sx={{ ml: effectiveDrawerOpen ? 0 : '-8px', color: 'var(--accent-gold)' }}>
            {effectiveDrawerOpen ? <ChevronLeftIcon /> : <MenuIcon />}
        </IconButton>
      </Toolbar>
      <Divider />
      
      {/* --- SIDEBAR NAVIGATION (FLEX GROW TO PUSH FOOTER DOWN) --- */}
      <List sx={{p: 1, flexGrow: 1 }}>
        {[
          { text: "Dashboard", icon: <DashboardIcon />, index: 0 },
          { text: "Analyze", icon: <TroubleshootIcon />, index: 1 },
          { text: "History", icon: <HistoryIcon />, index: 2 },
          { text: "Settings", icon: <SettingsIcon />, index: 3 },
          { text: "Feedback", icon: <FeedbackIcon />, index: 4 }, // NEW TAB
        ].map((item) => (
          <ListItem disablePadding key={item.index} sx={{ display: 'block' }}>
            <ListItemButton
              selected={tabIndex === item.index}
              onClick={() => { setTabIndex(item.index); setMobileOpen(false); }}
              className="sidebar-list-item"
              sx={{
                minHeight: 48,
                justifyContent: effectiveDrawerOpen ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: effectiveDrawerOpen ? 3 : 'auto',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} sx={{ opacity: effectiveDrawerOpen ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      {/* --- FOOTER CONTAINER (PROFILE BOX + LOGOUT) --- */}
      <Box className="sidebar-footer" sx={{
          opacity: effectiveDrawerOpen ? 1 : 0,
          transition: 'opacity 0.3s',
      }}>
        {/* Profile Box */}
        <Box className="sidebar-profile-box" sx={{
            px: '16px',
            pb: '8px', // Space below the profile info
            // Removed custom border styles here
        }}>
          <Box
              display="flex"
              alignItems="center"
              gap={2}
              onClick={openProfile}
              // Changed padding to pt: 1, pb: 1 for minimal spacing
              sx={{ cursor: 'pointer', pt: 1, pb: 1.5, borderTop: '1px solid transparent' }} // Ensure no border top
          >
            <Avatar
              sx={{
                  width: 40,
                  height: 40,
                  cursor: 'pointer',
                  border: '3px solid transparent', // Ensures no golden ring
              }}
            />
            <Box sx={{ overflow: 'hidden' }}>
              {/* Displaying Display Name (Username) */}
              <Typography variant="subtitle2" noWrap>{displayName || "Loading..."}</Typography>
              <Box sx={{p: 0, m: 0, textTransform: 'none', justifyContent: 'flex-start' }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                      Signed In
                  </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
        
        {/* LOGOUT BUTTON */}
        <Box className="logout-box" sx={{
            padding: effectiveDrawerOpen ? '16px' : '10px 10px 16px',
            transition: 'padding 0.3s',
            pt: 0,
            borderTop: '1px solid transparent', // Ensures no border above this box
        }}>
          <Box sx={{ height: effectiveDrawerOpen ? '20px' : '0px' }} /> {/* NEW: Increased spacing box height to 20px */}
          <Button
            variant="contained"
            color="error"
            onClick={handleLogout}
            fullWidth
            sx={{ opacity: effectiveDrawerOpen ? 1 : 0, transition: 'opacity 0.3s' }}
          >
            Logout
          </Button>
        </Box>
      </Box>
    </Box>
  );

  const currentDrawerWidth = drawerOpen ? expandedDrawerWidth : miniDrawerWidth;

  // --- NEW: Filter and Sort Logic ---
  const getFilteredAndSortedHistory = () => {
    let currentHistory = [...history];

    // 1. FILTERING (by score category)
    if (historyScoreFilter !== 'all') {
      currentHistory = currentHistory.filter(h => {
        const score = h.skill_match;
        if (historyScoreFilter === 'excellent') return score >= 75;
        if (historyScoreFilter === 'moderate') return score >= 50 && score < 75;
        if (historyScoreFilter === 'needs_improvement') return score < 50;
        return true;
      });
    }

    // 2. SEARCHING (by filename or job description)
    if (historySearch) {
      const searchLower = historySearch.toLowerCase();
      currentHistory = currentHistory.filter(h =>
        h.resume_filename.toLowerCase().includes(searchLower) ||
        h.job_description.toLowerCase().includes(searchLower)
      );
    }

    // 3. SORTING (by timestamp or score)
    currentHistory.sort((a, b) => {
      if (historySortBy === 'skill_match') {
        // Sort descending by score
        return b.skill_match - a.skill_match;
      }
      // Default: Sort descending by timestamp (most recent first)
      if (a.timestamp > b.timestamp) return -1;
      if (a.timestamp < b.timestamp) return 1;
      return 0;
    });

    return currentHistory;
  };

  const visibleHistory = getFilteredAndSortedHistory();
  // ------------------------------------

  // --- NEW HANDLER: RESET LOCAL DATA ---
  const handleResetLocalData = async () => {
    try {
        // Clear local storage items, including the new ones
        localStorage.removeItem('themeMode'); // Changed from darkMode
        localStorage.removeItem('defaultTab');
        localStorage.removeItem('showHistoryPreview');
        
        // Log the user out using Firebase Auth
        await signOut(auth);
        
        enqueueSnackbar('Local data cleared. You have been logged out.', { variant: 'success' });
        
        // Force a full reload to ensure a complete UI reset
        window.location.reload();
        
    } catch (error) {
        console.error("Error resetting local data/logging out:", error);
        enqueueSnackbar("Error resetting data. Please log out manually.", { variant: 'error' });
    }
  };
  // -------------------------------------

  // --- HANDLER FOR SCROLLING ---
  const handleScrollToAuth = () => {
    // Scroll animation is replaced by a state switch
    setShowAuthSection(true);
  };
  // -----------------------------


  // ---------- LOGIN UI (Dynamic Landing Page) ----------
  
if (!user)
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Outer Container: Set height to 100vh and overflow to hidden */}
      <Box
        sx={{
          height: '100vh', // <--- FIXED HEIGHT
          overflow: 'hidden', // <--- DISABLES SCROLLING
          // position: 'relative', // For absolute positioning of sections
          backgroundColor: themeMode === 'dark' ? '#121212' : (themeMode === 'sepia' ? "#FBF0D9" : "#f4f6f8"), // FIX: Use themeMode
          color: themeMode === 'dark' ? '#F0F4F8' : (themeMode === 'sepia' ? "#4B371C" : "#000"), // FIX: Use themeMode
          transition: 'background-color 0.3s ease, color 0.3s ease'
        }}
      >
        
        {/* --- THEME TOGGLE (Top Right Corner - Select Control) --- */}
        <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 20, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="body2"
            fontWeight="medium"
            sx={{
              color: themeMode === 'dark' ? '#F0F4F8' : (themeMode === 'sepia' ? "#4B371C" : "#000"),
            }}
          >
            Theme:
          </Typography>
          <Select
            size="small"
            value={themeMode}
            onChange={handleThemeModeChange}
            sx={{
              minWidth: 120,
              backgroundColor: themeMode === 'dark' ? '#333' : (themeMode === 'sepia' ? "#E6D8B6" : "#fff"),
              color: themeMode === 'dark' ? '#F0F4F8' : (themeMode === 'sepia' ? "#4B371C" : "#000"),
              // Subtle border adjustment for visual polish on the login page
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: themeMode === 'dark' ? 'rgba(255, 193, 7, 0.4)' : (themeMode === 'sepia' ? 'rgba(75, 55, 28, 0.5)' : 'rgba(0, 0, 0, 0.2)'),
              },
            }}
          >
            <MenuItem value="light">☀️ Light</MenuItem>
            <MenuItem value="dark">🌑 Dark</MenuItem>
            <MenuItem value="sepia">📚 Sepia</MenuItem>
          </Select>
        </Box>
        {/* --- END THEME TOGGLE --- */}

        {/* 1. HERO SECTION (Animated to slide out) */}
        <Box
          component={motion.div}
          initial={{ x: 0, opacity: 1 }}
          animate={{ x: showAuthSection ? '-100%' : 0, opacity: showAuthSection ? 0 : 1 }}
          transition={{ duration: 0.5 }}
          sx={{
            height: '100%', // Take full height of parent Box
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'absolute', // Positioned absolutely within parent
            top: 0,
            left: 0,
            zIndex: 10,
            backgroundColor: themeMode === 'dark' ? '#121212' : (themeMode === 'sepia' ? "#FBF0D9" : "#f4f6f8"), // FIX: Use themeMode
            transition: 'background-color 0.3s ease',
          }}
        >
          {/* Hero Content Container - CENTERED */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              p: 4,
              maxWidth: 600,
              mx: 'auto'
            }}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8, type: "spring", stiffness: 100 }} // <-- ANIMATION UPDATED
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%'
              }}
            >
              {/* Logo (INCREASED SIZE) */}
              <Box sx={{ width: { xs: 150, sm: 180 }, height: { xs: 150, sm: 180 }, mb: 3 }}>
                <img
                  src={Logo}
                  alt="Resumifyy Logo"
                  style={{ height: '100%', width: 'auto', display: 'block' }}
                />
              </Box>

              {/* Project Name */}
              <Typography
                variant="h2"
                fontWeight="bold"
                sx={{
                  color: '#FFC107',
                  mb: 1,
                  letterSpacing: 2,
                  fontSize: { xs: '2.5rem', sm: '3.5rem' }
                }}
              >
                RESUMIFYY
              </Typography>

              {/* Tagline */}
              <Typography
                variant="h5"
                sx={{
                  fontStyle: 'italic',
                  color: themeMode === 'dark' ? '#9E9E9E' : (themeMode === 'sepia' ? "#79664D" : "#666"), // FIX: Use themeMode
                  fontSize: { xs: '1.2rem', sm: '1.5rem' }
                }}
              >
                Stop Guessing. Start Matching.
              </Typography>

              {/* Description */}
              <motion.div
                initial={{ y: 20, opacity: 0 }} // <-- ANIMATION UPDATED
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.5, duration: 1 }}
                style={{ width: '100%' }}
              >
                <Typography
                  variant="body1"
                  sx={{
                    mt: 4,
                    color: themeMode === 'dark' ? '#B0BEC5' : (themeMode === 'sepia' ? "#4B371C" : "#555"), // FIX: Use themeMode
                    lineHeight: 1.6
                  }}
                >
                  The AI-powered platform designed to optimize your resume
                  instantly, ensuring it passes modern Applicant Tracking
                  Systems (ATS).
                </Typography>
              </motion.div>

              {/* SCROLL DOWN BUTTON -> SWITCH STATE */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 2.0, duration: 0.8 }}
                whileHover={{ scale: 1.05 }} // <-- ANIMATION ADDED
                whileTap={{ scale: 0.95 }} // <-- ANIMATION ADDED
              >
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleScrollToAuth}
                  endIcon={<KeyboardArrowDownIcon />}
                  sx={{
                    mt: 6,
                    py: 1.5,
                    px: 4,
                    fontSize: '1.1rem',
                    backgroundColor: '#FFC107',
                    color: '#000',
                    fontWeight: 700,
                    '&:hover': {
                      backgroundColor: '#FFB300'
                    }
                  }}
                >
                  Get Started
                </Button>
              </motion.div>
            </motion.div>
          </Box>
        </Box>

        {/* 2. AUTH SECTION (Below the fold) - Animated to slide in */}
        <Box
          component={motion.div}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: showAuthSection ? 0 : '100%', opacity: showAuthSection ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          ref={authFormRef}
          sx={{
            height: '100%', // Take full height of parent Box
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'absolute', // Positioned absolutely within parent
            top: 0,
            left: 0,
            zIndex: 15,
            backgroundColor: themeMode === 'dark' ? '#1E1E1E' : (themeMode === 'sepia' ? "#E6D8B6" : "#ffffff"), // FIX: Use themeMode
            transition: 'background-color 0.3s ease',
            py: 8 // Responsive padding for content centering
          }}
        >
          <Paper
            sx={{
              p: 4,
              width: { xs: '90%', sm: 480 },
              maxWidth: 480,
              textAlign: 'center',
              backgroundColor: themeMode === 'dark' ? '#1E1E1E' : (themeMode === 'sepia' ? "#FFF5E0" : "#ffffff"), // FIX: Use themeMode
              color: themeMode === 'dark' ? '#F0F4F8' : (themeMode === 'sepia' ? "#4B371C" : "#000"), // FIX: Use themeMode
            }}
          >
            <motion.div
              key={showSignup ? 'signup' : 'login'}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, type: 'spring', stiffness: 100 }}
            >
              <Box display="flex" justifyContent="center" alignItems="center" gap={2} mb={2}>
                <Avatar sx={{ width: 64, height: 64, bgcolor: '#FFC107' }} />
              </Box>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                {showSignup ? 'Create Account' : 'Welcome Back'}
              </Typography>
              
              {/* --- LOGIN/SIGNUP FIELDS --- */}
              <TextField
                label="Email (For Authentication)"
                fullWidth
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                variant="outlined"
              />
              {showSignup && (
                <TextField
                  label="Username (Display Name)"
                  fullWidth
                  margin="normal"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  variant="outlined"
                  helperText="This name will be displayed in the app."
                />
              )}
              <TextField
                label="Password"
                type="password"
                fullWidth
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                variant="outlined"
              />
              {/* --- END LOGIN/SIGNUP FIELDS --- */}
              
              {showSignup && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ mt: 1 }}
                >
                  Password must be at least 6 characters.
                </Typography>
              )}
              {showSignup ? (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleSignup}
                  sx={{ mt: 2, backgroundColor: '#FFC107', color: '#000' }}
                >
                  Create Account
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleLogin}
                  sx={{ mt: 2, backgroundColor: '#FFC107', color: '#000' }}
                >
                  Login to Resumifyy
                </Button>
              )}
              {!showSignup && (
                <Button
                  size="small"
                  sx={{ mt: 1, color: '#FFC107' }}
                  onClick={() => setForgotOpen(true)}
                >
                  Forgot Password?
                </Button>
              )}
              <Box mt={2}>
                <Button
                  size="small"
                  onClick={() => setShowSignup(!showSignup)}
                  sx={{ color: '#FFC107' }}
                >
                  {showSignup ? 'Back to Login' : "Don't have an account? Sign Up"}
                </Button>
              </Box>

              {/* Password Reset Dialog */}
              <Dialog open={forgotOpen} onClose={() => setForgotOpen(false)}>
                <DialogTitle>Reset Password</DialogTitle>
                <DialogContent>
                  <TextField
                    label="Enter your Email"
                    fullWidth
                    margin="dense"
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    helperText="We will send a password reset link to this email."
                  />
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setForgotOpen(false)}>Cancel</Button>
                  <Button onClick={handleForgotPassword} variant="contained">
                    Send Reset Email
                  </Button>
                </DialogActions>
              </Dialog>
            </motion.div>
          </Paper>
        </Box>
        {/* BRANDING ON LOGIN PAGE */}
        <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              opacity: 0.5,
              zIndex: 20
            }}
          >
            <Typography variant="caption" fontWeight="bold" sx={{ color: themeMode === 'dark' ? 'var(--text-secondary)' : (themeMode === 'sepia' ? "#79664D" : "#666") }}>
              RESUMIFYY
            </Typography>
            <Box sx={{ width: 44, height: 44 }}> {/* FIX: Increased size */}
              <img
                src={Logo}
                alt="Logo"
                style={{ height: '100%', width: 'auto', display: 'block' }}
              />
            </Box>
          </Box>
      </Box>
    </ThemeProvider>
  );

  // ---------- MAIN APP UI (Dynamic Layout) ----------
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className={`app-layout-box ${themeMode}-mode`}>
        
        <AppBar
          position="fixed"
          className="app-bar"
          sx={{
            width: { md: `calc(100% - ${currentDrawerWidth}px)` }, // Dynamic width
            ml: { md: `${currentDrawerWidth}px` }, // Dynamic margin
            transition: theme.transitions.create(['width', 'margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          }}
        >
          <Toolbar>
            {/* Mobile Menu Icon (Still needed for small screens) */}
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div">
              {tabIndex === 0 && "Dashboard"}
              {tabIndex === 1 && "Analyze Resume"}
              {tabIndex === 2 && "Analysis History"}
              {tabIndex === 3 && "Settings"}
              {tabIndex === 4 && "User Feedback"}
            </Typography>
          </Toolbar>
        </AppBar>

        <Box
          component="nav"
          sx={{ width: { md: currentDrawerWidth }, flexShrink: { md: 0 } }}
        >
          {/* Mobile Drawer (Temporary) */}
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            className={`sidebar-drawer ${themeMode}-mode`}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: expandedDrawerWidth, display: 'flex', flexDirection: 'column' },
            }}
          >
            {drawerContent}
          </Drawer>
          
          {/* Desktop Drawer (Permanent/Collapsible) */}
          <Drawer
            variant="permanent"
            className={`sidebar-drawer ${themeMode}-mode`}
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: currentDrawerWidth, // Dynamic width
                display: 'flex',
                flexDirection: 'column',
                transition: theme.transitions.create('width', { // Smooth transition
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
              },
            }}
            open
          >
            {drawerContent}
          </Drawer>
        </Box>

        <Box
          component="main"
          ref={mainContentRef} // <-- REF ADDED FOR SCROLL RESET
          className="main-content-area"
          sx={{
            flexGrow: 1,
            p: { xs: 2, md: 3 },
            ml: { md: `${currentDrawerWidth}px` }, // Dynamic margin
            width: { md: `calc(100% - ${currentDrawerWidth}px)` }, // Dynamic width
            mt: { xs: '64px', md: '0px' },
            minHeight: '100vh', // Ensure main content fills viewport to show branding
            position: 'relative', // Context for absolute branding
            transition: theme.transitions.create(['margin', 'width'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflowY: 'auto' // <-- ENSURE THIS IS SCROLLABLE
          }}
        >
          <Toolbar />
          
          {tabIndex === 0 && (
            <motion.div
              key="dashboard" // <-- Add key for re-animation
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              {/* --- DASHBOARD: PASSING themeMode PROP --- */}
              <Dashboard history={history} username={displayName} darkMode={themeMode === 'dark'} />
            </motion.div>
          )}

          {tabIndex === 1 && (
            <motion.div // <-- Added animation wrapper
              key="analyze" // <-- Add key for re-animation
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <Paper elevation={0} sx={{ p: 3, maxWidth: 820, mx: 'auto' }} className="upload-section">
                <label htmlFor="file-upload">
                  <input
                    type="file"
                    accept="application/pdf,.docx"
                    id="file-upload"
                    hidden
                    onChange={handleFileChange}
                  />
                  <Button variant="contained" color="primary" component="span" startIcon={<CloudUploadIcon />}>
                    {file ? file.name : "Upload Resume (PDF/DOCX)"}
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
                <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                  {/* --- ANALYZE BUTTON TOOLTIP --- */}
                  <Tooltip title="Match your resume skills against the job description using AI to get a score and suggestions.">
                    <Button
                      variant="contained"
                      color="primary"
                      size="large"
                      onClick={handleSubmit}
                      disabled={loading}
                      sx={{ mt: 2 }}
                    >
                      {loading ? <CircularProgress size={20} /> : "Analyze"}
                    </Button>
                  </Tooltip>
                  {/* --- END ANALYZE BUTTON TOOLTIP --- */}

                  {loading && (
                    <Box sx={{ flex: 1, minWidth: 120 }}>
                      <LinearProgress color="primary" />
                    </Box>
                  )}
                </Box>
              </Paper>

              {result && (
                <Box id="result-card" sx={{ mt: 4 }}>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                    <ResultCard
                      result={result}
                      originalResumeText={currentResumeText}
                      originalJobDesc={jobDesc}
                    />
                    <Button variant="outlined" color="primary" startIcon={<DownloadIcon />} onClick={() => setPdfOptionsOpen(true)} sx={{ mt: 2 }}>
                      Download as PDF
                    </Button>
                  </motion.div>
                </Box>
              )}
            </motion.div>
          )}

          {tabIndex === 2 && (
            <motion.div // <-- Added animation wrapper
              key="history" // <-- Add key for re-animation
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
            <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
                <Typography variant="h5" fontWeight="bold" display="flex" alignItems="center" gap={1}>
                  <HistoryIcon /> Past Analyses (Cloud)
                </Typography>
                
                {/* --- Search Field --- */}
                <TextField
                    size="small"
                    label="Search (Filename/JD)"
                    variant="outlined"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    sx={{ width: { xs: '100%', sm: 250 } }}
                />

                {/* --- Sort By Select --- */}
                <Box sx={{ minWidth: 120 }}>
                    <Select
                        size="small"
                        value={historySortBy}
                        onChange={(e) => setHistorySortBy(e.target.value)}
                        displayEmpty
                        fullWidth
                    >
                        <MenuItem value="timestamp">Sort by Date (Newest)</MenuItem>
                        <MenuItem value="skill_match">Sort by Score (Highest)</MenuItem>
                    </Select>
                </Box>
                
                {/* --- Filter By Score --- */}
                <Box sx={{ minWidth: 120 }}>
                    <Select
                        size="small"
                        value={historyScoreFilter}
                        onChange={(e) => setHistoryScoreFilter(e.target.value)}
                        displayEmpty
                        fullWidth
                    >
                        <MenuItem value="all">Filter by Score: All</MenuItem>
                        <MenuItem value="excellent">Excellent (>= 75%)</MenuItem>
                        <MenuItem value="moderate">Moderate (50-74%)</MenuItem>
                        <MenuItem value="needs_improvement">Needs Improvement (&lt; 50%)</MenuItem>
                    </Select>
                </Box>

              </Box>
              <Grid container spacing={2}>
                {visibleHistory.length === 0 ? (
                  <Grid item xs={12}>
                    <Typography color="text.secondary" align="center" sx={{mt: 4}}>
                      {history.length > 0 ? "No results match your search and filters." : "No history found. Run an analysis to see your results."}
                    </Typography>
                  </Grid>
                ) : (
                  visibleHistory.map((h, i) => {
                    const hh = normalizeAnalysis(h);
                    return (
                      <Grid item xs={12} sm={6} key={hh.id}>
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }} // <-- ANIMATION ADDED
                          animate={{ opacity: 1, y: 0 }} // <-- ANIMATION ADDED
                          transition={{ duration: 0.3, delay: i * 0.05 }} // <-- ANIMATION ADDED (Staggered)
                          whileHover={{ scale: 1.01 }} 
                        >
                          <Paper
                            elevation={2}
                            sx={{
                                p: 2,
                                my: 1,
                                cursor: 'pointer',
                                // Apply conditional styling for enhanced preview visibility
                                '&:hover .history-preview-details': {
                                    opacity: showHistoryPreview ? 1 : 0,
                                    maxHeight: showHistoryPreview ? '100px' : '0px',
                                }
                            }}
                            onClick={() => handleHistoryClick(hh)} // Opens modal
                          >
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                {/* Details Area (Left Side) */}
                                <Box sx={{ flexGrow: 1, pr: 1 }}>
                                    <Typography variant="subtitle1" fontWeight="bold" noWrap>
                                        {hh.resume_filename}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {hh.timestamp.split(',')[0]}
                                    </Typography>
                                    <Typography variant="body1">
                                        Skill Match: <strong style={{ color: hh.skill_match >= 75 ? '#2e7d32' : hh.skill_match >= 50 ? '#f9a825' : '#d32f2f' }}>{hh.skill_match}%</strong>
                                    </Typography>
                                </Box>
                              
                                {/* DELETE BUTTON (Right Side) */}
                                <IconButton
                                    size="small"
                                    color="error"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevents the parent Paper onClick (opening modal)
                                        handleDeleteHistoryItem(hh.id, hh.resume_filename);
                                    }}
                                    sx={{ mt: -1, mr: -1 }} // Adjust position
                                >
                                    <DeleteSweepIcon fontSize="small" />
                                </IconButton>
                              
                            </Box>
                            
                            {/* Detailed preview box (Bottom) */}
                            <Box
                                className="history-preview-details"
                                sx={{
                                    opacity: 0,
                                    maxHeight: '0px',
                                    overflow: 'hidden',
                                    transition: 'opacity 0.3s, max-height 0.3s',
                                    mt: 1,
                                    borderLeft: '2px solid #FFC107',
                                    pl: 1
                                }}
                            >
                                <Typography variant="caption" display="block" color="text.secondary" noWrap>
                                    JD: {hh.job_description.substring(0, 100)}...
                                </Typography>
                            </Box>
                          </Paper>
                        </motion.div>
                      </Grid>
                    );
                  })
                )}
              </Grid>
            </Box>
            </motion.div>
          )}

          {tabIndex === 3 && (
            <motion.div // <-- Added animation wrapper
              key="settings" // <-- Add key for re-animation
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
            <Box sx={{ maxWidth: 700, mx: 'auto' }}>
              
              {/* --- 1. DISPLAY SETTINGS --- */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
                <Paper sx={{ p: 4, mb: 3 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>Display Settings</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Configure the application's local display and theme.
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  {/* Theme Mode Selection (NEW CONTROL) */}
                  <Box sx={{ mb: 3 }}>
                      <FormControlLabel
                          control={
                              <Select
                                  size="small"
                                  value={themeMode}
                                  onChange={handleThemeModeChange} // FIX: Used correct handler
                                  sx={{ minWidth: 150 }}
                              >
                                  <MenuItem value="light">☀️ Light (Bright)</MenuItem>
                                  <MenuItem value="dark">🌑 Dark (Default)</MenuItem>
                                  <MenuItem value="sepia">📚 Sepia (Soft Eye)</MenuItem>
                              </Select>
                          }
                          label={<Typography variant="body1" fontWeight="medium">Select Theme Mode:</Typography>}
                          labelPlacement="start"
                          sx={{ justifyContent: 'space-between', width: '100%', m: 0, '& .MuiFormControlLabel-label': { ml: 0 } }}
                      />
                      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                          Choose the visual theme for your application. Sepia mode offers warmer colors for better eye comfort.
                      </Typography>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Dashboard Default Tab (NEW SETTING) */}
                  <Box sx={{ mb: 3 }}>
                      <FormControlLabel
                          control={
                              <Select
                                  size="small"
                                  value={defaultTab}
                                  onChange={handleDefaultTabChange}
                                  sx={{ minWidth: 150 }}
                              >
                                  <MenuItem value="0">Dashboard</MenuItem>
                                  <MenuItem value="1">Analyze Resume</MenuItem>
                              </Select>
                          }
                          label={<Box display="flex" alignItems="center"><TabIcon sx={{mr: 1}} /> <Typography variant="body1" fontWeight="medium">Default Starting Tab:</Typography></Box>}
                          labelPlacement="start"
                          sx={{ justifyContent: 'space-between', width: '100%', m: 0, '& .MuiFormControlLabel-label': { ml: 0 } }}
                      />
                      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                          The tab that opens automatically when you log in.
                      </Typography>
                  </Box>
                  
                  {/* History Preview Toggle (NEW SETTING) */}
                  <Box sx={{ mb: 3 }}>
                      <FormControlLabel
                          control={
                              <Switch
                                  checked={showHistoryPreview}
                                  onChange={handleShowHistoryPreviewChange}
                                  color="primary"
                              />
                          }
                          label={<Box display="flex" alignItems="center"><VisibilityIcon sx={{mr: 1}} /> <Typography variant="body1" fontWeight="medium">Show History Hover Preview</Typography></Box>}
                          labelPlacement="start"
                          sx={{ justifyContent: 'space-between', width: '100%', m: 0, '& .MuiFormControlLabel-label': { ml: 0 } }}
                      />
                      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                          Show a brief snippet of the Job Description when hovering over an item in the History tab.
                      </Typography>
                  </Box>
                </Paper>
              </motion.div>
              
              {/* --- 2. USER ACCOUNT AND DATA SETTINGS --- */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
                <Paper sx={{ p: 4, mb: 3 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>User Account and Cloud Data</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Manage your credentials and cloud history.
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      
                      {/* Change Display Name Button */}
                      <Button
                          variant="outlined"
                          startIcon={<BadgeIcon />}
                          onClick={() => { setNewDisplayName(displayName); setChangeDisplayNameOpen(true); }}
                          fullWidth
                          sx={{ justifyContent: 'flex-start' }}
                          disabled={!user}
                      >
                          Change Display Name ({displayName})
                      </Button>
                      
                      {/* Change Password Button */}
                      <Button
                          variant="outlined"
                          startIcon={<LockOpenIcon />}
                          onClick={() => { setResetUsername(user?.email); setForgotOpen(true); }}
                          fullWidth
                          sx={{ justifyContent: 'flex-start' }}
                          disabled={!user}
                      >
                          Change Password (via Email Reset)
                      </Button>
                      <Button
                          variant="outlined"
                          startIcon={<DeleteSweepIcon />}
                          onClick={handleClearCloudHistory}
                          fullWidth
                          color="error"
                          sx={{
                              justifyContent: 'flex-start',
                              // FIX: Use themeMode to check if we are in light/sepia base for disabling colors
                              color: history.length === 0 && themeMode !== 'dark' ? theme.palette.text.secondary : undefined,
                              borderColor: history.length === 0 && themeMode !== 'dark' ? theme.palette.action.disabledBackground : undefined,
                              '&.Mui-disabled': {
                                  // This ensures the text and border are visible gray when disabled
                                  color: history.length === 0 ? `${theme.palette.text.secondary} !important` : undefined,
                                  borderColor: history.length === 0 ? `${theme.palette.action.disabledBackground} !important` : undefined,
                              },
                          }}
                          disabled={!user || history.length === 0}
                      >
                          Clear All Cloud History ({history.length} items)
                      </Button>
                  </Box>
                </Paper>
              </motion.div>

              {/* --- 3. LOCAL DATA RESET --- */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
                <Paper sx={{ p: 4 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>Local Cache Reset</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Use this to clear local preferences, force logout, or fix display issues.
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Button
                      variant="outlined"
                      color="error"
                      onClick={handleResetLocalData}
                      fullWidth
                  >
                      Reset Local Display Settings & Logout
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                      This clears theme, default tab, and preview preferences. Cloud history remains untouched.
                  </Typography>
                </Paper>
              </motion.div>
            </Box>
            </motion.div>
          )}

          {tabIndex === 4 && (
  <Box
    component={motion.div}
    key="feedback" // <-- Add key for re-animation
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3 }}
    sx={{
      maxWidth: { xs: '100%', md: 1000 },
      mx: 'auto',
      minHeight: '85vh',
      display: 'flex',
      flexDirection: 'column',
      py: { xs: 2, md: 5 }
    }}
  >
    {/* HEADER SECTION */}
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
    >
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <Typography
          variant="h3"
          fontWeight="bold"
          gutterBottom
          sx={{
            color: theme.palette.primary.main,
            mb: 1,
            background: 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: { xs: '2rem', md: '3rem' }
          }}
        >
          Your Opinion Matters!
        </Typography>
        <Typography
          variant="h6"
          fontWeight="300"
          sx={{
            color: themeMode === 'dark' ? '#B0BEC5' : (themeMode === 'sepia' ? "#79664D" : "#666"),
            fontSize: { xs: '1rem', md: '1.3rem' },
            fontStyle: 'italic',
            mt: 2,
            maxWidth: 700,
            mx: 'auto'
          }}
        >
          "We promise this app is less buggy than your code. Help us keep it that way." 💪
        </Typography>
      </Box>
    </motion.div>

    <Divider sx={{ mb: 6 }} />

    {/* SECTION 1: FEEDBACK TYPE */}
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      <Paper
        sx={{
          p: { xs: 3, md: 4 },
          mb: 4,
          background: themeMode === 'dark' ? 'rgba(255, 193, 7, 0.08)' : 'rgba(255, 193, 7, 0.05)',
          border: `2px solid ${theme.palette.primary.main}`,
          borderRadius: 2,
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: `0 8px 24px ${themeMode === 'dark' ? 'rgba(255, 193, 7, 0.2)' : 'rgba(255, 193, 7, 0.1)'}`
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box
           
            sx={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              bgcolor: theme.palette.primary.main,
              color: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '1.5rem',
              flexShrink: 0
            }}
          >
            1️⃣
          </Box>
          <Box>
            <Typography
              variant="h6"
              fontWeight="bold"
              sx={{ color: 'text.primary', fontSize: '1.3rem' }}
            >
              What's Your Vibe?
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Pick the type of feedback you're bringing to the table
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ pl: { xs: 0, md: 9 } }}>
          <Select
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value)}
            fullWidth
            size="large"
            sx={{
              fontSize: '1.1rem',
              fontWeight: '600',
              bgcolor: themeMode === 'dark' ? '#2a2a2a' : '#f5f5f5',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.primary.main,
                borderWidth: '2px'
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#FFB300'
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#FFB300',
                borderWidth: '2px'
              }
            }}
          >
            <MenuItem value="Suggestion" sx={{ fontSize: '1rem', py: 1.5 }}>
              🚀 Feature Suggestion – I Have a Brilliant Idea
            </MenuItem>
            <MenuItem value="Bug" sx={{ fontSize: '1rem', py: 1.5 }}>
              🐛 Bug Report – Something Broke (Oops!)
            </MenuItem>
            <MenuItem value="Rating" sx={{ fontSize: '1rem', py: 1.5 }}>
              ⭐ General Comment – Just Saying Hello
            </MenuItem>
          </Select>
        </Box>
      </Paper>
    </motion.div>

    {/* SECTION 2: RATING */}
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
    >
      <Paper
        sx={{
          p: { xs: 3, md: 4 },
          mb: 4,
          background: themeMode === 'dark' ? 'rgba(46, 125, 50, 0.08)' : 'rgba(46, 125, 50, 0.05)',
          border: `2px solid #2e7d32`,
          borderRadius: 2,
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: `0 8px 24px ${themeMode === 'dark' ? 'rgba(46, 125, 50, 0.2)' : 'rgba(46, 125, 50, 0.1)'}`
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box
            sx={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              bgcolor: '#2e7d32',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '1.5rem',
              flexShrink: 0
            }}
          >
            2️⃣
          </Box>
          <Box>
            <Typography
              variant="h6"
              fontWeight="bold"
              sx={{ color: 'text.primary', fontSize: '1.3rem' }}
            >
              How Are We Doing?
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Rate your experience with Resumifyy (1-5 stars)
            </Typography>
          </Box>
        </Box>

        <Box sx={{ pl: { xs: 0, md: 9 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Rating
              name="overall-rating"
              value={feedbackRating}
              onChange={(event, newValue) => setFeedbackRating(newValue)}
              precision={1}
              size="large"
              sx={{
                '& .MuiRating-iconFilled': { color: theme.palette.primary.main },
                '& .MuiRating-iconEmpty': { color: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' },
                transition: 'transform 0.2s ease',
                '& .MuiIconButton-root': {
                  transition: 'transform 0.2s ease',
                  '&:hover': { transform: 'scale(1.15)' }
                }
              }}
            />
            <Typography
              variant="h6"
              fontWeight="bold"
              sx={{
                color: theme.palette.primary.main,
                minWidth: 60,
                fontSize: '1.3rem'
              }}
            >
              {feedbackRating}/5
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            ✓ Your rating is anonymous – be brutally honest!
          </Typography>
        </Box>
      </Paper>
    </motion.div>

    {/* SECTION 3: DETAILED FEEDBACK */}
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      <Paper
        sx={{
          p: { xs: 3, md: 4 },
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: themeMode === 'dark' ? 'rgba(25, 118, 210, 0.08)' : 'rgba(25, 118, 210, 0.05)',
          border: `2px solid #1976D2`,
          borderRadius: 2,
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: `0 8px 24px ${themeMode === 'dark' ? 'rgba(25, 118, 210, 0.2)' : 'rgba(25, 118, 210, 0.1)'}`
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box
            sx={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              bgcolor: '#1976D2',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '1.5rem',
              flexShrink: 0
            }}
          >
            3️⃣
          </Box>
          <Box>
            <Typography
              variant="h6"
              fontWeight="bold"
              sx={{ color: 'text.primary', fontSize: '1.3rem' }}
            >
              Spill the Tea ☕
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Drop your detailed feedback here (be specific!)
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', pl: { xs: 0, md: 9 } }}>
  <TextField
    multiline
    rows={10}
    value={feedbackText}
    onChange={(e) => setFeedbackText(e.target.value)}
    fullWidth
    placeholder={`Tell us about the ${feedbackType.toLowerCase()}...\n\nExample: "The Dashboard is awesome, but the History search keeps eating my filters when I breathe too hard."`}
    sx={{
      flex: 1,
      '& .MuiOutlinedInput-root': {
        bgcolor:
          themeMode === 'dark'
            ? '#2a2a2a'
            : themeMode === 'sepia'
            ? '#FFF5E0'
            : '#f5f5f5',
        '& fieldset': { borderWidth: '2px', borderColor: 'transparent' },
        '&:hover fieldset': { borderColor: '#1565C0' },
        '&.Mui-focused fieldset': { borderColor: '#1565C0', borderWidth: '2px' },
      },
      '& .MuiOutlinedInput-input': {
        fontSize: '1.05rem',
        lineHeight: '1.6',
        color:
          themeMode === 'dark'
            ? '#F0F4F8'
            : themeMode === 'sepia'
            ? '#4B371C'
            : '#000000',
        '&::placeholder': {
          color:
            themeMode === 'dark'
              ? '#9E9E9E'
              : themeMode === 'sepia'
              ? '#79664D'
              : '#666666',
          opacity: 1,
        },
      },
    }}
  />
          {/* Word Count Indicator */}
          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {feedbackText.length} characters • Minimum 10 required
            </Typography>
            <Box
              sx={{
                width: 120,
                height: 6,
                bgcolor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderRadius: 3,
                overflow: 'hidden'
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((feedbackText.length / 100) * 100, 100)}%` }}
                transition={{ type: 'spring', stiffness: 80 }}
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #FFC107, #FFB300)',
                  borderRadius: 3
                }}
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* SUBMIT BUTTON - BELOW FEEDBACK BOX */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, duration: 0.5 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{ marginTop: '2rem' }}
      >
        <Button
          variant="contained"
          onClick={handleFeedbackSubmit}
          fullWidth
          size="large"
          disabled={!user || feedbackText.trim().length < 10}
          sx={{
            py: 2.5,
            fontSize: '1.2rem',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
            color: '#000',
            borderRadius: 1.5,
            textTransform: 'uppercase',
            letterSpacing: 1,
            transition: 'all 0.3s ease',
            boxShadow: '0 6px 20px rgba(255, 193, 7, 0.4)',
            '&:hover:not(:disabled)': {
              boxShadow: '0 12px 30px rgba(255, 193, 7, 0.6)',
              transform: 'translateY(-2px)'
            },
            '&:disabled': {
              opacity: 0.6,
              cursor: 'not-allowed'
            }
          }}
        >
          ✨ Submit Feedback Securely ✨
        </Button>
      </motion.div>

      {/* USER INFO & REQUIREMENTS */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.75, duration: 0.5 }}
      >
        <Box sx={{ mt: 3, p: 2.5, bgcolor: 'action.hover', borderRadius: 1.5, textAlign: 'center' }}>
          <Typography variant="body2" fontWeight="600" sx={{ mb: 1 }}>
            {user ? `🔐 Submitting as: ${displayName} (${user.email})` : "🔒 Please log in to submit feedback"}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            ✓ Feedback saved securely to cloud • ✓ We read every single one
          </Typography>
        </Box>
      </motion.div>
    </motion.div>
  </Box>
)}


          {/* --- HISTORY DETAIL MODAL (Unchanged) --- */}
          <Dialog open={historyModalOpen} onClose={handleHistoryModalClose} fullWidth maxWidth="md">
            <DialogTitle>
              Analysis Details: {selectedHistory?.resume_filename || 'Loading...'}
            </DialogTitle>
            <DialogContent dividers>
              {selectedHistory ? (
                <Box>
                   <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Analyzed on: {selectedHistory.timestamp}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <ResultCard
                    result={selectedHistory}
                    originalResumeText={selectedHistory.resume_text || "Resume text not available for history item."}
                    originalJobDesc={selectedHistory.job_description || "Job description not available."}
                  />
                  <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Typography variant="body2" fontWeight="bold">Job Description Used:</Typography>
                    <Typography variant="body2" whiteSpace="pre-line">{selectedHistory.job_description}</Typography>
                  </Box>
                </Box>
              ) : (
                <CircularProgress />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleHistoryModalClose} color="primary" autoFocus>Close</Button>
            </DialogActions>
          </Dialog>
          
          {/* --- CHANGE DISPLAY NAME DIALOG (NEW) --- */}
          <Dialog open={changeDisplayNameOpen} onClose={() => setChangeDisplayNameOpen(false)}>
            <DialogTitle>Change Display Name</DialogTitle>
            <DialogContent>
              <TextField
                label="New Display Name (Username)"
                fullWidth
                margin="dense"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                helperText="This name will appear in the sidebar and dashboard."
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setChangeDisplayNameOpen(false)}>Cancel</Button>
              <Button onClick={handleChangeDisplayName} variant="contained" color="primary">
                Save Name
              </Button>
            </DialogActions>
          </Dialog>

          {/* --- NEW: PDF DOWNLOAD OPTIONS DIALOG --- */}
          <Dialog open={pdfOptionsOpen} onClose={() => setPdfOptionsOpen(false)}>
            <DialogTitle>PDF Download Options</DialogTitle>
            <DialogContent>
              <FormControl component="fieldset" sx={{ mt: 1 }}>
                <FormLabel component="legend">Select PDF Theme</FormLabel>
                <RadioGroup
                  row
                  aria-label="pdf-theme"
                  name="pdf-theme-group"
                  value={pdfTheme}
                  onChange={(e) => setPdfTheme(e.target.value)}
                >
                  <FormControlLabel value="light" control={<Radio />} label="Light Theme" />
                  <FormControlLabel value="dark" control={<Radio />} label="Dark Theme" />
                </RadioGroup>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPdfOptionsOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  handleDownloadPDF(); // This will now read the state
                  setPdfOptionsOpen(false);
                }}
                variant="contained"
                color="primary"
              >
                Download
              </Button>
            </DialogActions>
          </Dialog>

          {/* --- NEW: GUIDED ONBOARDING DIALOG --- */}
          <Dialog open={showOnboarding} fullWidth maxWidth="sm" disableEscapeKeyDown>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ bgcolor: '#FFC107' }}>👋</Avatar>
                <Typography variant="h6" fontWeight="bold">Welcome to Resumifyy, {displayName}!</Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body1" sx={{ mb: 2 }}>
                We're excited to help you match your resume to your dream job. Here’s a quick guide:
              </Typography>
              
              <Box sx={{ mb: 2, p: 2, borderLeft: '3px solid #FFC107', bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><TroubleshootIcon fontSize="small"/> Step 1: Analyze</Typography>
                <Typography variant="body2" color="text.secondary">
                  Go to the **Analyze** tab (index 1), upload your resume (PDF/DOCX), and paste the job description you want to match. Hit 'Analyze'!
                </Typography>
              </Box>

              <Box sx={{ mb: 2, p: 2, borderLeft: '3px solid #2e7d32', bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><DashboardIcon fontSize="small"/> Step 2: Review & Improve</Typography>
                <Typography variant="body2" color="text.secondary">
                  Check your **Skill Match %** and review the AI-suggested improvements. Use the **"AI-Optimize"** button to instantly rewrite parts of your resume!
                </Typography>
              </Box>

              <Box sx={{ p: 2, borderLeft: '3px solid #1976D2', bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><HistoryIcon fontSize="small"/> Step 3: Track</Typography>
                <Typography variant="body2" color="text.secondary">
                  Your results are automatically saved in the **History** tab (index 2) so you can track your progress over time.
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => handleOnboardingComplete(0)} color="inherit">
                Go to Dashboard
              </Button>
              <Button
                onClick={() => handleOnboardingComplete(1)}
                variant="contained"
                color="primary"
                sx={{ color: 'black !important' }} // Ensure black text on gold button
              >
                Start Analyzing Now
              </Button>
            </DialogActions>
          </Dialog>
          {/* --- END ONBOARDING DIALOG --- */}
          
          
          
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;