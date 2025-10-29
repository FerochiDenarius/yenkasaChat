// routes/appverification.routes.js - PHASED VERIFICATION SYSTEM
const express = require('express');
const router = express.Router();
const AppVerification = require('../models/appverification.model');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');

// ✅ Get user's verification dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId).select('verified emailVerified phoneVerified createdAt');
    
    let appVerification = await AppVerification.findOne({ userId });
    
    // Create verification record if doesn't exist
    if (!appVerification) {
      appVerification = new AppVerification({ userId });
      await appVerification.save();
    }
    
    // Update account age
    await appVerification.updateAccountAge(user.createdAt);
    
    // Get current requirements and progress
    const requirements = appVerification.getCurrentRequirements();
    const progress = appVerification.checkRequirementsMet();
    
    // Calculate days remaining in current phase
    const now = new Date();
    const daysRemaining = Math.ceil((appVerification.phaseEndDate - now) / (1000 * 60 * 60 * 24));
    
    res.json({
      detailsVerification: {
        email: user.emailVerified || false,
        phone: user.phoneVerified || false,
        basicPostingEnabled: user.verified || false
      },
      appVerification: {
        currentPhase: appVerification.currentPhase,
        hasVerifiedBanner: appVerification.hasVerifiedBanner,
        phaseStartDate: appVerification.phaseStartDate,
        phaseEndDate: appVerification.phaseEndDate,
        daysRemaining: Math.max(0, daysRemaining),
        requirements: requirements,
        currentMetrics: appVerification.metrics,
        progress: progress,
        phaseHistory: appVerification.phaseHistory
      }
    });
  } catch (err) {
    console.error('❌ Failed to fetch verification dashboard:', err);
    res.status(500).json({ error: 'Failed to fetch verification dashboard' });
  }
});

// ✅ Track daily login
router.post('/track-login', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    let appVerification = await AppVerification.findOne({ userId });
    
    if (!appVerification) {
      appVerification = new AppVerification({ userId });
      await appVerification.save();
    }
    
    const wasNewDay = await appVerification.trackLogin();
    
    res.json({
      success: true,
      newDayLogged: wasNewDay,
      dailyLogins: appVerification.metrics.dailyLogins
    });
  } catch (err) {
    console.error('❌ Failed to track login:', err);
    res.status(500).json({ error: 'Failed to track login' });
  }
});

// ✅ Track ad view
router.post('/track-ad-view', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    let appVerification = await AppVerification.findOne({ userId });
    
    if (!appVerification) {
      appVerification = new AppVerification({ userId });
      await appVerification.save();
    }
    
    await appVerification.trackAdView();
    
    res.json({
      success: true,
      adsViewed: appVerification.metrics.adsViewed
    });
  } catch (err) {
    console.error('❌ Failed to track ad view:', err);
    res.status(500).json({ error: 'Failed to track ad view' });
  }
});

// ✅ Check and advance phase (run monthly or on-demand)
router.post('/check-phase-advancement', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    let appVerification = await AppVerification.findOne({ userId });
    
    if (!appVerification) {
      return res.status(404).json({ error: 'Verification record not found' });
    }
    
    // Update account age
    await appVerification.updateAccountAge(user.createdAt);
    
    // Check if phase has ended
    const now = new Date();
    const phaseEnded = now >= appVerification.phaseEndDate;
    
    if (!phaseEnded) {
      return res.status(400).json({ 
        error: 'Phase period not yet complete',
        daysRemaining: Math.ceil((appVerification.phaseEndDate - now) / (1000 * 60 * 60 * 24))
      });
    }
    
    // Check if all requirements met
    const progress = appVerification.checkRequirementsMet();
    
    if (progress.allMet) {
      const advanced = await appVerification.advancePhase();
      
      if (advanced) {
        // Update user's verification phase in User model
        user.verificationPhase = appVerification.currentPhase === 2 ? 'standard' : 
                                  appVerification.currentPhase >= 4 ? 'growth' : 'promotion';
        await user.save();
        
        return res.json({
          success: true,
          message: `Congratulations! You've advanced to Phase ${appVerification.currentPhase}!`,
          newPhase: appVerification.currentPhase,
          hasVerifiedBanner: true,
          nextRequirements: appVerification.getCurrentRequirements()
        });
      } else {
        return res.json({
          success: true,
          message: 'You have completed all verification phases!',
          phase: appVerification.currentPhase
        });
      }
    } else {
      return res.status(400).json({
        error: 'Requirements not met for phase advancement',
        progress: progress,
        requirements: appVerification.getCurrentRequirements()
      });
    }
  } catch (err) {
    console.error('❌ Failed to check phase advancement:', err);
    res.status(500).json({ error: 'Failed to check phase advancement' });
  }
});

// ✅ Update metrics (called by other services)
router.post('/update-metrics', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, value } = req.body;
    
    let appVerification = await AppVerification.findOne({ userId });
    
    if (!appVerification) {
      appVerification = new AppVerification({ userId });
      await appVerification.save();
    }
    
    // Update specific metric
    switch(type) {
      case 'comment':
        appVerification.metrics.totalComments += 1;
        break;
      case 'follower':
        appVerification.metrics.totalFollowers += (value || 1);
        break;
      case 'maxLikes':
        if (value > appVerification.metrics.maxLikesOnPost) {
          appVerification.metrics.maxLikesOnPost = value;
        }
        break;
      default:
        return res.status(400).json({ error: 'Invalid metric type' });
    }
    
    await appVerification.save();
    
    res.json({
      success: true,
      metrics: appVerification.metrics
    });
  } catch (err) {
    console.error('❌ Failed to update metrics:', err);
    res.status(500).json({ error: 'Failed to update metrics' });
  }
});

// ✅ Get verification progress percentage
router.get('/progress', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    const appVerification = await AppVerification.findOne({ userId });
    
    if (!appVerification) {
      return res.json({ progress: 0, phase: 1 });
    }
    
    await appVerification.updateAccountAge(user.createdAt);
    
    const requirements = appVerification.getCurrentRequirements();
    const metrics = appVerification.metrics;
    
    // Calculate percentage for each requirement
    const percentages = {
      accountAge: Math.min(100, (metrics.accountAge / requirements.accountAge) * 100),
      comments: Math.min(100, (metrics.totalComments / requirements.comments) * 100),
      followers: Math.min(100, (metrics.totalFollowers / requirements.followers) * 100),
      maxLikes: Math.min(100, (metrics.maxLikesOnPost / requirements.maxLikes) * 100),
      dailyLogins: Math.min(100, (metrics.dailyLogins / requirements.dailyLogins) * 100),
      adsViewed: Math.min(100, (metrics.adsViewed / requirements.adsViewed) * 100)
    };
    
    // Calculate overall progress (average of all)
    const overallProgress = Object.values(percentages).reduce((a, b) => a + b, 0) / 6;
    
    res.json({
      phase: appVerification.currentPhase,
      overallProgress: Math.round(overallProgress),
      detailedProgress: percentages,
      requirements: requirements,
      currentMetrics: metrics
    });
  } catch (err) {
    console.error('❌ Failed to fetch progress:', err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

module.exports = router;