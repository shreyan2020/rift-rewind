import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { createJourney, createJourneyFromUpload, type JourneyRequest } from './api';
import Journey from './components/Journey';
import FriendComparison from './components/FriendComparison';

type Mode = 'api' | 'upload' | 'compare';

function App() {
  const [mode, setMode] = useState<Mode>('api');
  const [jobId, setJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bypassCache, setBypassCache] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [uploadedJourneyData, setUploadedJourneyData] = useState<any>(null);
  const [formData, setFormData] = useState<JourneyRequest>({
    platform: 'euw1',
    riotId: '',
    archetype: 'explorer',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await createJourney({
        ...formData,
        bypassCache,
      });
      setJobId(response.jobId);
    } catch (error) {
      console.error('Failed to create journey:', error);
      alert('Failed to start your journey. Please try again.');
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Check if it's a complete journey package (new format)
      if (data.type === 'complete-journey' && data.metadata && data.quarters && data.finale) {
        setUploadedFile(data);
        setUploadedJourneyData(data); // Store for direct display
        return;
      }
      
      // Check if it's the old format (raw matches with Q1-Q4)
      if (data.Q1 || data.Q2 || data.Q3 || data.Q4) {
        setUploadedFile(data);
        setUploadedJourneyData(null); // Will need backend processing
        return;
      }
      
      throw new Error('Invalid data format. File must be either a complete journey package or contain Q1-Q4 match data.');
    } catch (error) {
      console.error('Failed to parse uploaded file:', error);
      alert('Invalid file format. Please upload a valid journey-upload.json file.');
      setUploadedFile(null);
      setUploadedJourneyData(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!uploadedFile) {
      alert('Please select a file first');
      return;
    }

    // If it's a complete journey package, display it directly
    if (uploadedJourneyData) {
      // Create a fake jobId to trigger Journey component
      setJobId('uploaded-journey');
      return;
    }

    // Otherwise, send to backend for processing (legacy path)
    setIsLoading(true);
    try {
      const response = await createJourneyFromUpload({
        platform: formData.platform,
        riotId: formData.riotId,
        archetype: formData.archetype,
        uploadedMatches: uploadedFile,
      });

      setJobId(response.jobId);
    } catch (error) {
      console.error('Failed to process uploaded file:', error);
      alert('Failed to upload data. Please check the file format and try again.');
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setJobId(null);
    setIsLoading(false);
    setFormData({
      platform: 'euw1',
      riotId: '',
      archetype: 'explorer',
    });
  };

  if (jobId) {
    return <Journey 
      jobId={jobId} 
      riotId={formData.riotId} 
      onReset={handleReset}
      uploadedJourneyData={uploadedJourneyData}
    />;
  }

  if (mode === 'compare') {
    return <FriendComparison onBack={() => setMode('api')} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <motion.h1
            className="text-5xl font-bold text-runeterra-gold mb-4"
            animate={{ textShadow: ['0 0 10px #c8aa6e', '0 0 20px #c8aa6e', '0 0 10px #c8aa6e'] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Rift Rewind
          </motion.h1>
          <p className="text-runeterra-gold-light text-lg">
            Embark on a journey through Runeterra
          </p>
          <p className="text-gray-400 mt-2">
            Discover your story across the 2025 season
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('api')}
            className={`flex-1 py-3 rounded-lg font-medium transition-all ${
              mode === 'api'
                ? 'bg-runeterra-gold text-runeterra-darker'
                : 'bg-runeterra-dark/50 text-runeterra-gold-light border border-runeterra-gold/30'
            }`}
          >
            Fetch from Riot API
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              mode === 'upload'
                ? 'bg-runeterra-gold text-runeterra-darker'
                : 'bg-runeterra-dark/50 text-runeterra-gold-light border border-runeterra-gold/30'
            }`}
          >
            <Upload size={18} />
            Upload Data
          </button>
          <button
            onClick={() => setMode('compare')}
            className={`flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              mode === 'compare'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-runeterra-dark/50 text-runeterra-gold-light border border-purple-500/30'
            }`}
          >
            🤝 Compare with Friend
          </button>
        </div>

        {mode === 'api' ? (
          <motion.form
            onSubmit={handleSubmit}
            className="bg-runeterra-dark/50 backdrop-blur-sm border border-runeterra-gold/30 rounded-lg p-8 shadow-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
          <div className="space-y-6">
            <div>
              <label className="block text-runeterra-gold-light mb-2 font-medium">
                Summoner Name
              </label>
              <input
                type="text"
                placeholder="Name#TAG"
                value={formData.riotId}
                onChange={(e) => setFormData({ ...formData, riotId: e.target.value })}
                className="w-full px-4 py-3 bg-runeterra-darker border border-runeterra-gold/30 rounded-lg text-runeterra-gold-light focus:outline-none focus:border-runeterra-gold transition-colors"
                required
              />
              <p className="text-sm text-gray-400 mt-1">e.g., Faker#KR1</p>
            </div>

            <div>
              <label className="block text-runeterra-gold-light mb-2 font-medium">
                Region
              </label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className="w-full px-4 py-3 bg-runeterra-darker border border-runeterra-gold/30 rounded-lg text-runeterra-gold-light focus:outline-none focus:border-runeterra-gold transition-colors"
              >
                <option value="euw1">EUW</option>
                <option value="eun1">EUNE</option>
                <option value="na1">NA</option>
                <option value="br1">BR</option>
                <option value="la1">LAN</option>
                <option value="la2">LAS</option>
                <option value="kr">KR</option>
                <option value="jp1">JP</option>
                <option value="oc1">OCE</option>
              </select>
            </div>

            <div>
              <label className="block text-runeterra-gold-light mb-2 font-medium">
                Archetype
              </label>
              <select
                value={formData.archetype}
                onChange={(e) => setFormData({ ...formData, archetype: e.target.value })}
                className="w-full px-4 py-3 bg-runeterra-darker border border-runeterra-gold/30 rounded-lg text-runeterra-gold-light focus:outline-none focus:border-runeterra-gold transition-colors"
              >
                <option value="explorer">Explorer</option>
                <option value="warrior">Warrior</option>
                <option value="sage">Sage</option>
                <option value="guardian">Guardian</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="bypassCache"
                checked={bypassCache}
                onChange={(e) => setBypassCache(e.target.checked)}
                className="w-4 h-4 rounded border-runeterra-gold/30 bg-runeterra-darker focus:ring-runeterra-gold"
              />
              <label htmlFor="bypassCache" className="text-sm text-runeterra-gold-light">
                Force refresh (bypass cache)
              </label>
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-runeterra-gold to-runeterra-gold-light text-runeterra-darker font-bold rounded-lg hover:shadow-lg hover:shadow-runeterra-gold/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? 'Preparing Your Journey...' : 'Begin Journey'}
            </motion.button>
          </div>
        </motion.form>
        ) : (
          <motion.div
            className="bg-runeterra-dark/50 backdrop-blur-sm border border-runeterra-gold/30 rounded-lg p-8 shadow-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="space-y-6">
              <div>
                <label className="block text-runeterra-gold-light mb-2 font-medium">
                  Upload Match Data
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="w-full px-4 py-3 bg-runeterra-darker border border-runeterra-gold/30 rounded-lg text-runeterra-gold-light file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-runeterra-gold file:text-runeterra-darker file:font-medium hover:file:bg-runeterra-gold-light focus:outline-none focus:border-runeterra-gold transition-colors"
                />
                <p className="text-sm text-gray-400 mt-1">
                  Upload matches-upload.json generated by aggregate_matches.py
                </p>
              </div>

              <div>
                <label className="block text-runeterra-gold-light mb-2 font-medium">
                  Summoner Name
                </label>
                <input
                  type="text"
                  placeholder="Name#TAG"
                  value={formData.riotId}
                  onChange={(e) => setFormData({ ...formData, riotId: e.target.value })}
                  className="w-full px-4 py-3 bg-runeterra-darker border border-runeterra-gold/30 rounded-lg text-runeterra-gold-light focus:outline-none focus:border-runeterra-gold transition-colors"
                  required
                />
                <p className="text-sm text-gray-400 mt-1">e.g., Faker#KR1</p>
              </div>

              <div>
                <label className="block text-runeterra-gold-light mb-2 font-medium">
                  Region
                </label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full px-4 py-3 bg-runeterra-darker border border-runeterra-gold/30 rounded-lg text-runeterra-gold-light focus:outline-none focus:border-runeterra-gold transition-colors"
                >
                  <option value="euw1">EUW</option>
                  <option value="eun1">EUNE</option>
                  <option value="na1">NA</option>
                  <option value="br1">BR</option>
                  <option value="la1">LAN</option>
                  <option value="la2">LAS</option>
                  <option value="kr">KR</option>
                  <option value="jp1">JP</option>
                  <option value="oc1">OCE</option>
                </select>
              </div>

              <div>
                <label className="block text-runeterra-gold-light mb-2 font-medium">
                  Archetype
                </label>
                <select
                  value={formData.archetype}
                  onChange={(e) => setFormData({ ...formData, archetype: e.target.value })}
                  className="w-full px-4 py-3 bg-runeterra-darker border border-runeterra-gold/30 rounded-lg text-runeterra-gold-light focus:outline-none focus:border-runeterra-gold transition-colors"
                >
                  <option value="explorer">Explorer</option>
                  <option value="warrior">Warrior</option>
                  <option value="sage">Sage</option>
                  <option value="guardian">Guardian</option>
                </select>
              </div>

              <motion.button
                onClick={handleUploadSubmit}
                disabled={isLoading || !uploadedFile}
                className="w-full py-4 bg-gradient-to-r from-runeterra-gold to-runeterra-gold-light text-runeterra-darker font-bold rounded-lg hover:shadow-lg hover:shadow-runeterra-gold/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? 'Preparing Your Journey...' : uploadedFile ? 'Begin Journey' : 'Please Select a File First'}
              </motion.button>
            </div>
          </motion.div>
        )}

        <p className="text-center text-gray-500 text-sm mt-6">
          A journey through your 2025 League of Legends season
        </p>
      </motion.div>
    </div>
  );
}

export default App;

