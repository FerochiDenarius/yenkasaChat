import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:yenkasa_ai_flutter/app/yenkasa_ai_app.dart';

void main() {
  testWidgets('renders YenkasaAI landing shell', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: YenkasaAiApp()));
    await tester.pump();

    expect(find.text('YenkasaAI'), findsWidgets);
    expect(find.text('Launch YenkasaAI'), findsOneWidget);
  });
}
