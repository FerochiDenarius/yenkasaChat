import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/analytics/presentation/analytics_page.dart';
import '../../features/chat/presentation/chat_page.dart';
import '../../features/dashboard/presentation/landing_page.dart';
import '../../features/ingestion/presentation/ingestion_page.dart';
import '../../features/knowledge/presentation/knowledge_page.dart';
import '../../features/moderation/presentation/moderation_page.dart';
import '../../features/shell/presentation/ai_shell.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: LandingPage()),
      ),
      ShellRoute(
        builder: (context, state, child) =>
            AiShell(currentLocation: state.uri.path, child: child),
        routes: [
          GoRoute(
            path: '/chat',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: ChatPage()),
          ),
          GoRoute(
            path: '/knowledge',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: KnowledgePage()),
          ),
          GoRoute(
            path: '/moderation',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: ModerationPage()),
          ),
          GoRoute(
            path: '/analytics',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: AnalyticsPage()),
          ),
          GoRoute(
            path: '/ingestion',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: IngestionPage()),
          ),
        ],
      ),
    ],
    errorPageBuilder: (context, state) {
      return NoTransitionPage(
        child: Scaffold(
          body: Center(child: Text('Route not found: ${state.uri.path}')),
        ),
      );
    },
  );
});
