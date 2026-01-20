import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, User, LogOut, Home, Plus, Shield, Clock, Lock, Camera } from 'lucide-react';
import { supabase } from './supabase';
import './App.css';

export default function SocialMediaWithParentalControls() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(false);
  const [userLikes, setUserLikes] = useState(new Set());
  
  const [selectedAvatar, setSelectedAvatar] = useState('cat');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  
  const [accountType, setAccountType] = useState('child');
  const [parentPin, setParentPin] = useState('');
  const [showParentalSettings, setShowParentalSettings] = useState(false);
  const [timeLimit, setTimeLimit] = useState(60);
  const [sessionStart, setSessionStart] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null);
  const [contentFilter, setContentFilter] = useState(true);
  const [postApproval, setPostApproval] = useState(true);
  const [viewOnly, setViewOnly] = useState(false);
  const [parentApprovalPin, setParentApprovalPin] = useState('');
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pendingPost, setPendingPost] = useState('');

  const avatarOptions = [
    { id: 'cat', emoji: '🐱', name: 'Cat' },
    { id: 'dog', emoji: '🐶', name: 'Dog' },
    { id: 'bear', emoji: '🐻', name: 'Bear' },
    { id: 'fox', emoji: '🦊', name: 'Fox' },
    { id: 'panda', emoji: '🐼', name: 'Panda' },
    { id: 'koala', emoji: '🐨', name: 'Koala' },
    { id: 'tiger', emoji: '🐯', name: 'Tiger' },
    { id: 'lion', emoji: '🦁', name: 'Lion' },
    { id: 'unicorn', emoji: '🦄', name: 'Unicorn' },
    { id: 'dragon', emoji: '🐉', name: 'Dragon' },
    { id: 'robot', emoji: '🤖', name: 'Robot' },
    { id: 'alien', emoji: '👽', name: 'Alien' },
    { id: 'owl', emoji: '🦉', name: 'Owl' },
    { id: 't-rex', emoji: '🦖', name: 'T-Rex' }
  ];

  const getAvatarEmoji = (avatarId) => {
    const avatar = avatarOptions.find(a => a.id === avatarId);
    return avatar ? avatar.emoji : '👤';
  };

  useEffect(() => {
    if (isLoggedIn && currentUser?.accountType === 'child' && sessionStart) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStart) / 1000 / 60);
        const remaining = timeLimit - elapsed;
        setRemainingTime(remaining);
        
        if (remaining <= 0) {
          alert('Time limit reached! Logging out.');
          handleLogout();
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isLoggedIn, sessionStart, timeLimit, currentUser]);

  useEffect(() => {
    if (isLoggedIn) {
      loadPosts();
      loadUserLikes();

      const postsSubscription = supabase
        .channel('posts_channel')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'posts' },
          () => loadPosts()
        )
        .subscribe();

      const likesSubscription = supabase
        .channel('likes_channel')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'likes' },
          () => {
            loadPosts();
            loadUserLikes();
          }
        )
        .subscribe();

      return () => {
        postsSubscription.unsubscribe();
        likesSubscription.unsubscribe();
      };
    }
  }, [isLoggedIn]);

  const updateProfilePicture = async (avatarId) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ profile_picture: avatarId })
        .eq('username', currentUser.username);

      if (error) throw error;

      setCurrentUser({ ...currentUser, profilePicture: avatarId });
      setSelectedAvatar(avatarId);
      setShowAvatarPicker(false);
      alert('Profile picture updated!');
    } catch (err) {
      setError('Failed to update profile picture');
    }
  };

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      
      let filteredPosts = data || [];
      if (currentUser?.accountType === 'child' && contentFilter) {
        filteredPosts = filteredPosts.filter(post => !containsInappropriateContent(post.content));
      }
      
      setPosts(filteredPosts);
    } catch (err) {
      console.error('Error loading posts:', err);
    }
  };

  const containsInappropriateContent = (text) => {
    const inappropriateWords = ['bad', 'hate', 'stupid', 'dumb'];
    return inappropriateWords.some(word => text.toLowerCase().includes(word));
  };

  const loadUserLikes = async () => {
    if (!currentUser) return;
    
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('post_id')
        .eq('username', currentUser.username);

      if (error) throw error;
      setUserLikes(new Set(data.map(like => like.post_id)));
    } catch (err) {
      console.error('Error loading likes:', err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      setLoading(false);
      return;
    }

    if (isSignUp && !displayName.trim()) {
      setError('Display name is required');
      setLoading(false);
      return;
    }

    if (isSignUp && accountType === 'parent' && !parentPin.trim()) {
      setError('Parent PIN is required for parent accounts');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('username')
          .eq('username', username)
          .single();

        if (existingUser) {
          setError('Username already taken');
          setLoading(false);
          return;
        }

        const newUser = {
          username,
          password,
          display_name: displayName.trim(),
          bio: bio.trim() || 'Hey there! I am new here.',
          joined_at: Date.now(),
          posts: 0,
          account_type: accountType,
          parent_pin: accountType === 'parent' ? parentPin : null,
          time_limit: accountType === 'child' ? 60 : null,
          content_filter: accountType === 'child' ? true : null,
          post_approval: accountType === 'child' ? true : null,
          view_only: accountType === 'child' ? false : null,
          profile_picture: accountType === 'child' ? selectedAvatar : 'default'
        };

        const { error: insertError } = await supabase
          .from('users')
          .insert([newUser]);

        if (insertError) throw insertError;

        setCurrentUser({
          username: newUser.username,
          displayName: newUser.display_name,
          bio: newUser.bio,
          joinedAt: newUser.joined_at,
          posts: newUser.posts,
          accountType: newUser.account_type,
          parentPin: newUser.parent_pin,
          timeLimit: newUser.time_limit,
          contentFilter: newUser.content_filter,
          postApproval: newUser.post_approval,
          viewOnly: newUser.view_only,
          profilePicture: newUser.profile_picture
        });
        setIsLoggedIn(true);
        if (accountType === 'child') {
          setSessionStart(Date.now());
          setTimeLimit(newUser.time_limit || 60);
        }
      } else {
        const { data: user, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();

        if (fetchError || !user) {
          setError('User not found');
          setLoading(false);
          return;
        }

        if (user.password !== password) {
          setError('Incorrect password');
          setLoading(false);
          return;
        }

        setCurrentUser({
          username: user.username,
          displayName: user.display_name,
          bio: user.bio,
          joinedAt: user.joined_at,
          posts: user.posts,
          accountType: user.account_type || 'child',
          parentPin: user.parent_pin,
          timeLimit: user.time_limit || 60,
          contentFilter: user.content_filter !== false,
          postApproval: user.post_approval !== false,
          viewOnly: user.view_only || false,
          profilePicture: user.profile_picture || 'default'
        });
        setIsLoggedIn(true);
        setSelectedAvatar(user.profile_picture || 'cat');
        if (user.account_type === 'child') {
          setSessionStart(Date.now());
          setTimeLimit(user.time_limit || 60);
          setContentFilter(user.content_filter !== false);
          setPostApproval(user.post_approval !== false);
          setViewOnly(user.view_only || false);
        }
      }
    } catch (err) {
      setError('Authentication failed');
      console.error(err);
    }
    setLoading(false);
  };

  const createPost = async () => {
    if (!newPost.trim()) return;

    if (currentUser.accountType === 'child' && postApproval) {
      setPendingPost(newPost);
      setShowPinPrompt(true);
      return;
    }

    await submitPost(newPost);
  };

  const submitPost = async (content) => {
    try {
      const post = {
        username: currentUser.username,
        display_name: currentUser.displayName,
        content: content,
        timestamp: Date.now(),
        likes: 0,
        profile_picture: currentUser.profilePicture
      };

      const { error } = await supabase
        .from('posts')
        .insert([post]);

      if (error) throw error;

      const { error: updateError } = await supabase
        .from('users')
        .update({ posts: (currentUser.posts || 0) + 1 })
        .eq('username', currentUser.username);

      if (updateError) throw updateError;

      setCurrentUser({ ...currentUser, posts: (currentUser.posts || 0) + 1 });
      setNewPost('');
      setActiveTab('home');
      await loadPosts();
    } catch (err) {
      setError('Failed to create post');
      console.error(err);
    }
  };

  const handlePinApproval = async () => {
    if (parentApprovalPin === currentUser.parentPin) {
      setShowPinPrompt(false);
      setParentApprovalPin('');
      await submitPost(pendingPost);
      setPendingPost('');
      setError('');
    } else {
      setError('Incorrect parent PIN');
    }
  };

  const likePost = async (post) => {
    if (currentUser.accountType === 'child' && viewOnly) {
      setError('View-only mode is enabled');
      return;
    }

    try {
      const hasLiked = userLikes.has(post.id);

      if (hasLiked) {
        await supabase.from('likes').delete().eq('post_id', post.id).eq('username', currentUser.username);
        await supabase.from('posts').update({ likes: Math.max(0, post.likes - 1) }).eq('id', post.id);
      } else {
        await supabase.from('likes').insert([{ post_id: post.id, username: currentUser.username }]);
        await supabase.from('posts').update({ likes: post.likes + 1 }).eq('id', post.id);
      }

      await loadUserLikes();
      await loadPosts();
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  const updateParentalSettings = async (settings) => {
    try {
      await supabase.from('users').update(settings).eq('username', currentUser.username);
      setCurrentUser({ ...currentUser, ...settings });
      alert('Settings updated successfully!');
    } catch (err) {
      setError('Failed to update settings');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setUsername('');
    setPassword('');
    setDisplayName('');
    setBio('');
    setActiveTab('home');
    setUserLikes(new Set());
    setSessionStart(null);
    setRemainingTime(null);
  };

  const formatTime = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (!isLoggedIn) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="text-center mb-8">
            <div className="inline-block p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-4 logo-icon">
              <User className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold gradient-text">KCon</h1>
            <p className="text-gray-600 mt-2">Connect with friends and the world</p>
          </div>

          <div className="space-y-4">
            {isSignUp && (
              <>
                <div className="bg-purple-50 p-4 rounded-lg mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Step 1: Choose Account Type</label>
                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setAccountType('child')} 
                      className={`flex-1 p-3 rounded-lg border-2 transition-all ${accountType === 'child' ? 'border-purple-500 bg-purple-100' : 'border-gray-300 bg-white'}`}
                    >
                      <User className="w-6 h-6 mx-auto mb-1" />
                      <div className="text-sm font-semibold">Child</div>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setAccountType('parent')} 
                      className={`flex-1 p-3 rounded-lg border-2 transition-all ${accountType === 'parent' ? 'border-purple-500 bg-purple-100' : 'border-gray-300 bg-white'}`}
                    >
                      <Shield className="w-6 h-6 mx-auto mb-1" />
                      <div className="text-sm font-semibold">Parent</div>
                    </button>
                  </div>
                </div>

                {accountType === 'child' && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl mb-4 border-2 border-blue-300">
                    <label className="block text-lg font-bold text-gray-800 mb-2 text-center">
                      🎨 Step 2: Choose Your Avatar
                    </label>
                    <p className="text-sm text-gray-600 text-center mb-4">Pick your favorite character!</p>
                    
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      {avatarOptions.map((avatar) => (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => setSelectedAvatar(avatar.id)}
                          className={`text-4xl p-4 rounded-xl transition-all hover:scale-110 ${
                            selectedAvatar === avatar.id 
                              ? 'border-4 border-blue-500 bg-blue-200 shadow-xl scale-110 ring-4 ring-blue-300' 
                              : 'border-2 border-gray-300 bg-white hover:border-blue-300 hover:shadow-lg'
                          }`}
                          title={avatar.name}
                        >
                          {avatar.emoji}
                        </button>
                      ))}
                    </div>
                    
                    <div className="bg-blue-100 p-3 rounded-lg text-center">
                      <p className="text-sm font-semibold text-blue-800">
                        ✓ Selected: <span className="text-lg">{getAvatarEmoji(selectedAvatar)}</span> {avatarOptions.find(a => a.id === selectedAvatar)?.name}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isSignUp ? `Step ${accountType === 'child' ? '3' : '2'}: Username` : 'Username'}
              </label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleAuth(e)} 
                className="input-field" 
                placeholder="Enter username" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isSignUp ? `Step ${accountType === 'child' ? '4' : '3'}: Password` : 'Password'}
              </label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleAuth(e)} 
                className="input-field" 
                placeholder="Enter password" 
              />
            </div>

            {isSignUp && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Step {accountType === 'child' ? '5' : '4'}: Display Name
                  </label>
                  <input 
                    type="text" 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)} 
                    className="input-field" 
                    placeholder="Your name" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bio (optional)
                  </label>
                  <textarea 
                    value={bio} 
                    onChange={(e) => setBio(e.target.value)} 
                    className="input-field resize-none" 
                    rows="2" 
                    placeholder="Tell us about yourself..." 
                  />
                </div>

                {accountType === 'parent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Lock className="w-4 h-4 inline mr-1" />
                      Parent PIN (4 digits)
                    </label>
                    <input 
                      type="password" 
                      maxLength="4" 
                      value={parentPin} 
                      onChange={(e) => setParentPin(e.target.value.replace(/\D/g, ''))} 
                      className="input-field" 
                      placeholder="Enter 4-digit PIN" 
                    />
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button 
              onClick={handleAuth} 
              disabled={loading} 
              className="btn-primary"
            >
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>

            <button 
              onClick={() => { 
                setIsSignUp(!isSignUp); 
                setError(''); 
                setSelectedAvatar('cat');
                setAccountType('child');
              }} 
              className="w-full text-purple-600 text-sm hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>

          <div className="mt-6 p-4 bg-green-50 rounded-lg text-sm text-gray-600">
            <p className="font-semibold mb-1"><Shield className="w-4 h-4 inline mr-1" />Safe & Secure</p>
            <p>Parental controls included for child safety</p>
          </div>
        </div>
      </div>
    );
  }

  if (showPinPrompt) {
    return (
      <div className="min-h-screen bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <Lock className="w-16 h-16 mx-auto mb-4 text-purple-500" />
            <h2 className="text-2xl font-bold text-gray-800">Parent Approval Required</h2>
            <p className="text-gray-600 mt-2">Enter parent PIN to post</p>
          </div>

          <input 
            type="password" 
            maxLength="4" 
            value={parentApprovalPin} 
            onChange={(e) => setParentApprovalPin(e.target.value.replace(/\D/g, ''))} 
            className="input-field text-center text-2xl tracking-widest" 
            placeholder="••••" 
            autoFocus 
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mt-4">
              {error}
            </div>
          )}

          <div className="flex gap-4 mt-6">
            <button 
              onClick={() => { 
                setShowPinPrompt(false); 
                setParentApprovalPin(''); 
                setError(''); 
              }} 
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
            >
              Cancel
            </button>
            <button 
              onClick={handlePinApproval} 
              className="flex-1 btn-primary"
            >
              Approve
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showAvatarPicker) {
    return (
      <div className="min-h-screen bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <Camera className="w-16 h-16 mx-auto mb-4 text-purple-500" />
            <h2 className="text-2xl font-bold text-gray-800">Choose Your Avatar</h2>
            <p className="text-gray-600 mt-2">Pick a fun picture for your profile!</p>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-6">
            {avatarOptions.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                onClick={() => updateProfilePicture(avatar.id)}
                className={`text-4xl p-4 rounded-lg border-2 transition-all hover:scale-110 ${
                  selectedAvatar === avatar.id 
                    ? 'border-purple-500 bg-purple-100 scale-110' 
                    : 'border-gray-300 bg-white hover:border-purple-300'
                }`}
                title={avatar.name}
              >
                {avatar.emoji}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setShowAvatarPicker(false)} 
            className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="app-header">
        <div className="header-content">
          <h1 className="text-2xl font-bold gradient-text">KCon</h1>
          <div className="flex items-center space-x-4">
            {currentUser.accountType === 'child' && remainingTime !== null && (
              <div className="flex items-center space-x-2 text-sm font-medium text-gray-700 bg-yellow-100 px-3 py-2 rounded-lg">
                <Clock className="w-4 h-4" />
                <span>{remainingTime} min left</span>
              </div>
            )}
            {currentUser.accountType === 'parent' && (
              <button 
                onClick={() => setShowParentalSettings(!showParentalSettings)} 
                className="flex items-center space-x-1 bg-purple-500 text-white px-3 py-2 rounded-lg hover:bg-purple-600 transition-colors text-sm"
              >
                <Shield className="w-4 h-4" />
                <span>Controls</span>
              </button>
            )}
            <span className="text-sm font-medium text-gray-700">{currentUser.displayName}</span>
            <button 
              onClick={handleLogout} 
              className="flex items-center space-x-1 bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {showParentalSettings && currentUser.accountType === 'parent' && (
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-4">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <Shield className="w-6 h-6 mr-2 text-purple-500" />
              Parental Controls
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Limit (minutes per session)</label>
                <input 
                  type="number" 
                  value={timeLimit} 
                  onChange={(e) => setTimeLimit(parseInt(e.target.value))} 
                  className="input-field" 
                  min="15" 
                  max="480" 
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-800">Content Filter</div>
                  <div className="text-sm text-gray-600">Hide inappropriate content</div>
                </div>
                <button 
                  onClick={() => setContentFilter(!contentFilter)} 
                  className={`w-12 h-6 rounded-full transition-colors ${contentFilter ? 'bg-purple-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${contentFilter ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-800">Post Approval</div>
                  <div className="text-sm text-gray-600">Require PIN to post</div>
                </div>
                <button 
                  onClick={() => setPostApproval(!postApproval)} 
                  className={`w-12 h-6 rounded-full transition-colors ${postApproval ? 'bg-purple-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${postApproval ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-800">View Only Mode</div>
                  <div className="text-sm text-gray-600">Disable likes and posts</div>
                </div>
                <button 
                  onClick={() => setViewOnly(!viewOnly)} 
                  className={`w-12 h-6 rounded-full transition-colors ${viewOnly ? 'bg-purple-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${viewOnly ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <button 
                onClick={() => updateParentalSettings({ 
                  time_limit: timeLimit, 
                  content_filter: contentFilter, 
                  post_approval: postApproval, 
                  view_only: viewOnly 
                })} 
                className="btn-primary"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="app-container">
        <div className="nav-tabs">
          <button 
            onClick={() => setActiveTab('home')} 
            className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`}
          >
            <Home className="w-5 h-5" />
            <span className="font-medium">Home</span>
          </button>
          {!viewOnly && (
            <button 
              onClick={() => setActiveTab('create')} 
              className={`nav-tab ${activeTab === 'create' ? 'active' : ''}`}
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Create</span>
            </button>
          )}
          <button 
            onClick={() => setActiveTab('profile')} 
            className={`nav-tab ${activeTab === 'profile' ? 'active' : ''}`}
          >
            <User className="w-5 h-5" />
            <span className="font-medium">Profile</span>
          </button>
        </div>

        {activeTab === 'create' && !viewOnly && (
          <div className="post-card">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Create a Post</h2>
            <textarea 
              value={newPost} 
              onChange={(e) => setNewPost(e.target.value)} 
              placeholder="What's on your mind?" 
              className="post-textarea" 
              rows="4" 
            />
            <button 
              onClick={createPost} 
              disabled={!newPost.trim()} 
              className="btn-primary"
            >
              {postApproval && currentUser.accountType === 'child' ? 'Request Approval' : 'Post'}
            </button>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="post-card">
            <div className="flex items-center space-x-4 mb-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-4xl shadow-lg">
                  {currentUser.accountType === 'child' ? getAvatarEmoji(currentUser.profilePicture) : '👤'}
                </div>
                {currentUser.accountType === 'child' && (
                  <button
                    onClick={() => setShowAvatarPicker(true)}
                    className="absolute -bottom-1 -right-1 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors border-2 border-purple-500"
                  >
                    <Camera className="w-4 h-4 text-purple-500" />
                  </button>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{currentUser.displayName}</h2>
                <p className="text-gray-600">@{currentUser.username}</p>
                {currentUser.accountType === 'child' && (
                  <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-1">
                    Protected Account
                  </span>
                )}
                {currentUser.accountType === 'parent' && (
                  <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full mt-1">
                    Parent Account
                  </span>
                )}
              </div>
            </div>
            <p className="text-gray-700 mb-4">{currentUser.bio}</p>
            <div className="flex space-x-6 text-sm text-gray-600">
              <div>
                <span className="font-bold text-gray-800">{currentUser.posts || 0}</span> Posts
              </div>
              <div>
                <span className="font-bold text-gray-800">
                  {new Date(currentUser.joinedAt).toLocaleDateString()}
                </span> Joined
              </div>
            </div>
          </div>
        )}

        {activeTab === 'home' && (
          <div className="space-y-4 w-full">
            {posts.length === 0 ? (
              <div className="empty-state">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4 empty-icon" />
                <p className="text-gray-500 text-lg">No posts yet</p>
                <p className="text-gray-400 text-sm mt-2">Be the first to share something!</p>
              </div>
            ) : (
              posts.map((post) => {
                const hasLiked = userLikes.has(post.id);
                return (
                  <div key={post.id} className="post-card">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl shadow">
                        {getAvatarEmoji(post.profile_picture)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{post.display_name}</p>
                        <p className="text-sm text-gray-500">@{post.username} · {formatTime(post.timestamp)}</p>
                      </div>
                    </div>
                    <p className="text-gray-800 mb-4 whitespace-pre-wrap">{post.content}</p>
                    <div className="flex items-center space-x-6 text-gray-600">
                      <button 
                        onClick={() => likePost(post)} 
                        disabled={viewOnly} 
                        className={`like-button ${hasLiked ? 'liked' : ''} ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Heart className={`w-5 h-5 ${hasLiked ? 'fill-current' : ''}`} />
                        <span>{post.likes || 0}</span>
                      </button>
                      <div className="flex items-center space-x-2">
                        <MessageCircle className="w-5 h-5" />
                        <span>0</span>
                      </div>
                      <button className="flex items-center space-x-2 hover:text-blue-500 transition-colors">
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}