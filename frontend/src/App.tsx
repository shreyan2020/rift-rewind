import { useState } from 'react';
import { motion } from 'framer-motion';
import { createJourney, type JourneyRequest } from './api';
import Journey from './components/Journey';

function App() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bypassCache, setBypassCache] = useState(false);
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
    return <Journey jobId={jobId} riotId={formData.riotId} onReset={handleReset} />;
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

        <p className="text-center text-gray-500 text-sm mt-6">
          A journey through your 2025 League of Legends season
        </p>
      </motion.div>
    </div>
  );
}

export default App;

