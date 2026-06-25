import SwiftUI
import Observation

enum VerificationMethod: String {
    case switchEduID = "SWITCH edu-ID"
    case legiCard = "Legi card"
}

// MARK: - Discover filters

struct DiscoverFilters {
    static let ageBounds = 18...40

    var minAge = 18
    var maxAge = 40
    var genders: Set<Gender> = Set(Gender.allCases)
    var level: StudyLevel? = nil   // nil = any level

    var isActive: Bool {
        minAge > DiscoverFilters.ageBounds.lowerBound
            || maxAge < DiscoverFilters.ageBounds.upperBound
            || genders.count != Gender.allCases.count
            || level != nil
    }

    func matches(_ p: Profile) -> Bool {
        p.age >= minAge && p.age <= maxAge
            && genders.contains(p.gender)
            && (level == nil || p.level == level)
    }
}

@Observable
final class AppState {
    /// How long you have to reply before a match auto-expires.
    static let replyDeadline: TimeInterval = 48 * 3600

    // Nearby mode is OFF on every launch — not persisted.
    var isNearbyModeOn: Bool = ProcessInfo.processInfo.environment["UM_NEARBY"] == "1"

    var currentProfiles: [Profile] = mockProfiles
    var filters = DiscoverFilters()

    var matches: [Match] = AppState.seedMatches()

    var isVerified: Bool = ProcessInfo.processInfo.environment["UM_VERIFIED"] == "1"
    var verificationMethod: VerificationMethod = .switchEduID

    // Current user's own profile state
    var myBio: String = "Second-year CS. Coffee, climbing, and very long debugging sessions."
    var myUniversities: [String] = ["ETH Zürich", "UZH"]

    /// The swipe deck, after applying the active filters.
    var filteredProfiles: [Profile] {
        currentProfiles.filter { filters.matches($0) }
    }

    func like(_ profile: Profile) {
        guard !matches.contains(where: { $0.profile.id == profile.id }) else { return }
        // A fresh match is waiting on you to break the ice.
        matches.append(Match(profile: profile, awaitingYourReplySince: Date()))
    }

    func unmatch(_ match: Match) {
        matches.removeAll { $0.id == match.id }
    }

    /// Opens (or creates) a conversation with a nearby person and returns it.
    func chat(with person: NearbyPerson, tint: Color) -> Match {
        if let existing = matches.first(where: {
            $0.profile.name == person.name && $0.profile.university == person.university
        }) {
            return existing
        }
        let match = Match(profile: person.toProfile(tint: tint))   // you're initiating — no reply clock
        matches.append(match)
        return match
    }

    /// Removes matches you left hanging past the 48h reply deadline.
    /// Returns the names that were dropped, for a one-time notice.
    @discardableResult
    func evaluateAutoUnmatch(now: Date = Date()) -> [String] {
        let expired = matches.filter { m in
            guard let since = m.awaitingYourReplySince else { return false }
            return now.timeIntervalSince(since) > AppState.replyDeadline
        }
        let ids = Set(expired.map { $0.id })
        matches.removeAll { ids.contains($0.id) }
        return expired.map { $0.profile.name }
    }

    private static func seedMatches() -> [Match] {
        let h: TimeInterval = 3600
        return [
            Match(profile: mockProfiles[1],
                  messages: [ChatMessage(text: "Hey! How was your exam?", isMine: false)],
                  awaitingYourReplySince: Date().addingTimeInterval(-2 * h)),
            Match(profile: mockProfiles[2],
                  messages: [ChatMessage(text: "Same climbing gym tomorrow?", isMine: false)],
                  awaitingYourReplySince: Date().addingTimeInterval(-1 * h)),
            Match(profile: mockProfiles[4],
                  messages: [ChatMessage(text: "Haha that pasta story 😂", isMine: false)],
                  awaitingYourReplySince: Date().addingTimeInterval(-3 * h)),
            // Stale on purpose: unanswered for 49h → auto-unmatches on Matches open.
            Match(profile: mockProfiles[3],
                  messages: [ChatMessage(text: "Nice to match! Coffee this week?", isMine: false)],
                  awaitingYourReplySince: Date().addingTimeInterval(-49 * h)),
        ]
    }
}
