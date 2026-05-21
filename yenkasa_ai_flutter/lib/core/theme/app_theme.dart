import 'dart:ui';

import 'package:flutter/material.dart';

class AiPalette {
  static const Color violet = Color(0xFF7C3AED);
  static const Color violetDeep = Color(0xFF5B21B6);
  static const Color blue = Color(0xFF3B82F6);
  static const Color mint = Color(0xFF10B981);
  static const Color amber = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFEF4444);
  static const Color darkBg = Color(0xFF0A0B15);
  static const Color darkPanel = Color(0xFF121326);
  static const Color darkText = Color(0xFFF4F2FF);
  static const Color lightBg = Color(0xFFF7F5FF);
  static const Color lightPanel = Colors.white;
  static const Color lightText = Color(0xFF17113A);

  static LinearGradient primaryGradient = const LinearGradient(
    colors: [violetDeep, violet, blue],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

class AppTheme {
  static ThemeData light() {
    const scheme = ColorScheme.light(
      primary: AiPalette.violet,
      secondary: AiPalette.blue,
      surface: AiPalette.lightPanel,
      onSurface: AiPalette.lightText,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AiPalette.lightBg,
      textTheme: _textTheme(Brightness.light),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: Colors.white.withValues(alpha: 0.72),
        selectedColor: AiPalette.violet.withValues(alpha: 0.18),
        side: BorderSide(color: AiPalette.violet.withValues(alpha: 0.14)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      cardTheme: CardThemeData(
        color: Colors.white.withValues(alpha: 0.84),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      ),
      inputDecorationTheme: _inputTheme(Brightness.light),
    );
  }

  static ThemeData dark() {
    const scheme = ColorScheme.dark(
      primary: AiPalette.violet,
      secondary: AiPalette.blue,
      surface: AiPalette.darkPanel,
      onSurface: AiPalette.darkText,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AiPalette.darkBg,
      textTheme: _textTheme(Brightness.dark),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: Colors.white.withValues(alpha: 0.06),
        selectedColor: AiPalette.violet.withValues(alpha: 0.25),
        side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      cardTheme: CardThemeData(
        color: Colors.white.withValues(alpha: 0.08),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      ),
      inputDecorationTheme: _inputTheme(Brightness.dark),
    );
  }

  static TextTheme _textTheme(Brightness brightness) {
    final color = brightness == Brightness.dark
        ? AiPalette.darkText
        : AiPalette.lightText;
    return Typography.material2021().black.apply(
      bodyColor: color,
      displayColor: color,
    );
  }

  static InputDecorationTheme _inputTheme(Brightness brightness) {
    final fill = brightness == Brightness.dark
        ? Colors.white.withValues(alpha: 0.06)
        : Colors.white.withValues(alpha: 0.8);
    final borderColor = brightness == Brightness.dark
        ? Colors.white.withValues(alpha: 0.08)
        : AiPalette.violet.withValues(alpha: 0.12);

    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(24),
      borderSide: BorderSide(color: borderColor),
    );

    return InputDecorationTheme(
      filled: true,
      fillColor: fill,
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
        borderSide: const BorderSide(color: AiPalette.violet, width: 1.1),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    );
  }
}

BoxDecoration glassDecoration(BuildContext context, {bool strong = false}) {
  final dark = Theme.of(context).brightness == Brightness.dark;
  return BoxDecoration(
    color: dark
        ? Colors.white.withValues(alpha: strong ? 0.1 : 0.06)
        : Colors.white.withValues(alpha: strong ? 0.92 : 0.78),
    borderRadius: BorderRadius.circular(28),
    border: Border.all(
      color: dark
          ? Colors.white.withValues(alpha: 0.08)
          : AiPalette.violet.withValues(alpha: 0.12),
    ),
    boxShadow: [
      BoxShadow(
        color: dark
            ? Colors.black.withValues(alpha: 0.25)
            : AiPalette.violet.withValues(alpha: 0.08),
        blurRadius: 40,
        offset: const Offset(0, 18),
      ),
    ],
  );
}

class GlassBackdrop extends StatelessWidget {
  const GlassBackdrop({
    super.key,
    required this.child,
    this.strong = false,
    this.padding = const EdgeInsets.all(20),
  });

  final Widget child;
  final bool strong;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          padding: padding,
          decoration: glassDecoration(context, strong: strong),
          child: child,
        ),
      ),
    );
  }
}
