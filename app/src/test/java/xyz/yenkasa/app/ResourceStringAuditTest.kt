package xyz.yenkasa.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ResourceStringAuditTest {

    private val requiredLocalizedKeys = listOf(
        "arena",
        "live_caps",
        "hide_more_actions",
        "search_yenkasa"
    )

    private val livestreamLayouts = listOf(
        "activity_start_live.xml",
        "activity_live_stream.xml",
        "activity_live_streams.xml",
        "fragment_live_streams.xml",
        "item_live_stream.xml"
    )

    @Test
    fun criticalPlayerStringsExistInEveryLocale() {
        val localeFiles = listOf(
            "src/main/res/values/strings.xml",
            "src/main/res/values-fr/strings.xml",
            "src/main/res/values-ha/strings.xml",
            "src/main/res/values-tw/strings.xml"
        )

        localeFiles.forEach { path ->
            val text = File(path).readText()
            requiredLocalizedKeys.forEach { key ->
                assertTrue("$path is missing string key: $key", text.contains("name=\"$key\""))
            }
        }
    }

    @Test
    fun livestreamLayoutsDoNotUseHardcodedVisibleText() {
        val hardcodedTextPattern = Regex("""android:(text|hint|contentDescription)="(?!@string/|@null|\?|@\{)[^"]*[A-Za-z][^"]*"""")

        livestreamLayouts.forEach { fileName ->
            val file = File("src/main/res/layout/$fileName")
            val matches = hardcodedTextPattern.findAll(file.readText()).map { it.value }.toList()
            assertFalse("$fileName has hardcoded visible text: $matches", matches.isNotEmpty())
        }
    }
}
