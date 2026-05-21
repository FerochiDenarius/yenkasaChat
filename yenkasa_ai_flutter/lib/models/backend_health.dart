class BackendHealth {
  const BackendHealth({
    required this.status,
    required this.provider,
    required this.model,
    required this.projectId,
    required this.location,
    required this.collections,
    required this.collectionStats,
    required this.vectorDbPath,
    required this.gcsBucket,
    required this.snapshot,
    required this.startupTimings,
  });

  final String status;
  final String provider;
  final String model;
  final String projectId;
  final String location;
  final Map<String, String> collections;
  final Map<String, CollectionHealthStat> collectionStats;
  final String vectorDbPath;
  final String gcsBucket;
  final Map<String, dynamic> snapshot;
  final Map<String, dynamic> startupTimings;

  factory BackendHealth.fromJson(Map<String, dynamic> json) {
    final rawStats = (json['collection_stats'] as Map<String, dynamic>? ?? {});
    return BackendHealth(
      status: json['status'] as String? ?? 'unknown',
      provider: json['provider'] as String? ?? '',
      model: json['model'] as String? ?? '',
      projectId: json['project_id'] as String? ?? '',
      location: json['location'] as String? ?? '',
      collections: Map<String, String>.from(
        json['collections'] as Map? ?? const {},
      ),
      collectionStats: rawStats.map(
        (key, value) => MapEntry(
          key,
          CollectionHealthStat.fromJson(
            Map<String, dynamic>.from(value as Map),
          ),
        ),
      ),
      vectorDbPath: json['vector_db_path'] as String? ?? '',
      gcsBucket: json['gcs_bucket'] as String? ?? '',
      snapshot: Map<String, dynamic>.from(json['snapshot'] as Map? ?? const {}),
      startupTimings: Map<String, dynamic>.from(
        json['startup_timings'] as Map? ?? const {},
      ),
    );
  }
}

class CollectionHealthStat {
  const CollectionHealthStat({
    required this.name,
    required this.vectorCount,
    required this.sourceCount,
    required this.categoryCount,
  });

  final String name;
  final int vectorCount;
  final int sourceCount;
  final int categoryCount;

  factory CollectionHealthStat.fromJson(Map<String, dynamic> json) {
    return CollectionHealthStat(
      name: json['name'] as String? ?? '',
      vectorCount: json['vectorCount'] as int? ?? 0,
      sourceCount: json['sourceCount'] as int? ?? 0,
      categoryCount: json['categoryCount'] as int? ?? 0,
    );
  }
}
