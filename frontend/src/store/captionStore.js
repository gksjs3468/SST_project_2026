/**
 * Caption Store - Central state management for captions
 * Handles conflict-free management of AI-generated and human-corrected captions
 */
class CaptionStore {
  constructor() {
    this.captions = new Map(); // captionId -> CaptionData
    this.captionHistory = []; // Array of all captions in order
    this.corrections = new Map(); // captionId -> correctedText
    this.listeners = new Set();
  }

  /**
   * Add or update interim (incomplete) caption
   * @param {Object} captionData - { id, text, confidence, isFinal, timestamp, tokens }
   */
  addInterimCaption(captionData) {
    const { id } = captionData;

    // If this caption ID already exists and has a final version, don't update
    const existing = this.captions.get(id);
    if (existing && existing.isFinal) {
      return;
    }

    // Update or create caption
    const caption = {
      ...captionData,
      isFinal: false,
      originalText: captionData.text,
      correctedText: this.corrections.get(id) || null,
      status: 'interim', // interim | final | corrected
    };

    this.captions.set(id, caption);
    this.notifyListeners();
  }

  /**
   * Add final (complete) caption
   * @param {Object} captionData - { id, text, confidence, isFinal, timestamp, tokens }
   */
  addFinalCaption(captionData) {
    const { id } = captionData;

    const caption = {
      ...captionData,
      isFinal: true,
      originalText: captionData.text,
      correctedText: this.corrections.get(id) || null,
      status: 'final',
    };

    this.captions.set(id, caption);

    // Add to history
    this.captionHistory.push({
      ...caption,
      addedAt: Date.now(),
    });

    this.notifyListeners();
  }

  /**
   * Update caption with corrected text
   * @param {string} captionId - Unique caption identifier
   * @param {string} correctedText - Corrected text from admin
   */
  correctCaption(captionId, correctedText) {
    const caption = this.captions.get(captionId);

    if (!caption) {
      console.warn(`Caption not found: ${captionId}`);
      return;
    }

    // Store correction
    this.corrections.set(captionId, correctedText);

    // Update caption
    caption.correctedText = correctedText;
    caption.status = 'corrected';
    caption.correctedAt = Date.now();

    this.captions.set(captionId, caption);
    this.notifyListeners();
  }

  /**
   * Get caption by ID
   */
  getCaption(captionId) {
    return this.captions.get(captionId);
  }

  /**
   * Get all captions (sorted by timestamp)
   */
  getAllCaptions() {
    return Array.from(this.captions.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }

  /**
   * Get final captions only
   */
  getFinalCaptions() {
    return this.getAllCaptions().filter(c => c.isFinal);
  }

  /**
   * Get captions needing correction
   */
  getCaptionsNeedingCorrection() {
    return this.getAllCaptions().filter(c => c.status !== 'corrected' && c.isFinal);
  }

  /**
   * Get display text for caption (corrected if available, otherwise original)
   */
  getDisplayText(captionId) {
    const caption = this.captions.get(captionId);
    if (!caption) return '';
    return caption.correctedText || caption.originalText;
  }

  /**
   * Clear all captions
   */
  clearAll() {
    this.captions.clear();
    this.captionHistory = [];
    this.corrections.clear();
    this.notifyListeners();
  }

  /**
   * Get statistics
   */
  getStats() {
    const all = this.getAllCaptions();
    const corrected = all.filter(c => c.status === 'corrected');

    return {
      total: all.length,
      final: all.filter(c => c.isFinal).length,
      interim: all.filter(c => !c.isFinal).length,
      corrected: corrected.length,
      correctionRate: all.length > 0 ? (corrected.length / all.length) * 100 : 0,
    };
  }

  /**
   * Register listener for state changes
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  /**
   * Get current state snapshot
   */
  getState() {
    return {
      captions: this.getAllCaptions(),
      corrections: Object.fromEntries(this.corrections),
      stats: this.getStats(),
    };
  }
}

// Export singleton instance
export const captionStore = new CaptionStore();

export default CaptionStore;
