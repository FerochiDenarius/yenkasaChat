const viewSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    activityId: {
      type: String,
      unique: true,
      required: true
    },
    username: {
      type: String,
      default: ''
    },
    viewedAt: {
      type: Date,
      default: Date.now
    },

    watchDuration: { type: Number, default: 0 },

    mediaType: {
      type: String,
      enum: ['image', 'video', 'audio'],
      default: 'image'
    }
  },
  { timestamps: true }
);
