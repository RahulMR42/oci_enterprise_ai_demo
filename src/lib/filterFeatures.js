export function filterFeatures(features, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return features;
  }

  return features.filter((feature) => {
    const searchableText = [
      feature.title,
      feature.serviceArea,
      feature.summary,
      feature.details,
      feature.sampleUseCase,
      feature.terraformPath,
      feature.sdkModule,
      ...feature.capabilities
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}
