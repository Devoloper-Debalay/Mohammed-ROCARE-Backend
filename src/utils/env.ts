export const NLP = {
  provider: process.env.NLP_PROVIDER ?? "python",
  serviceUrl: process.env.NLP_SERVICE_URL ?? "",
  hfKey: process.env.HUGGINGFACE_API_KEY ?? "",
  python: {
    summarizer: process.env.PY_SUMMARIZER_URL,
    toxicity: process.env.PY_TOXICITY_URL,
    sentiment: process.env.PY_SENTIMENT_URL,
    keywords: process.env.PY_KEYWORDS_URL,
    classify: process.env.PY_CLASSIFY_URL,
    ner: process.env.PY_NER_URL,
  },
};
