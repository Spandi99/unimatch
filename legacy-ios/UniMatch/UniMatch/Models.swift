import SwiftUI

// MARK: - Enums

enum Gender: String, CaseIterable, Identifiable {
    case female = "Female"
    case male = "Male"
    case nonBinary = "Non-binary"
    var id: String { rawValue }
}

enum StudyLevel: String, CaseIterable, Identifiable {
    case bachelor = "Bachelor"
    case master = "Master"
    var id: String { rawValue }
}

// MARK: - Models

struct NearbyPerson: Identifiable, Hashable {
    let id = UUID()
    let initials: String
    let name: String
    let age: Int
    let university: String
    let degree: String
    let distanceMeters: Int
    var gender: Gender = .nonBinary

    /// Approximate distance, rounded to nearest 10m. Never exact GPS.
    var distanceLabel: String {
        let rounded = Int((Double(distanceMeters) / 10).rounded()) * 10
        return "~\(rounded)m"
    }

    static func == (lhs: NearbyPerson, rhs: NearbyPerson) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    /// A full Profile for starting a conversation from nearby mode.
    func toProfile(tint: Color) -> Profile {
        Profile(name: name, age: age, university: university, degree: degree,
                yearOfStudy: "", bio: "You crossed paths in nearby mode.",
                avatarColor: tint, distanceMeters: distanceMeters, gender: gender)
    }
}

struct Profile: Identifiable {
    let id = UUID()
    let name: String
    let age: Int
    let university: String
    let degree: String
    let yearOfStudy: String
    let bio: String
    let avatarColor: Color
    let distanceMeters: Int?
    let gender: Gender

    /// Bachelor vs master, derived from the degree prefix (BSc/BA → bachelor, MSc/MA → master).
    var level: StudyLevel {
        degree.uppercased().hasPrefix("M") ? .master : .bachelor
    }

    var initials: String {
        let comps = name.split(separator: " ")
        let first = comps.first?.prefix(1) ?? ""
        let last = comps.dropFirst().first?.prefix(1) ?? ""
        return (String(first) + String(last)).uppercased()
    }

    var distanceLabel: String? {
        guard let d = distanceMeters else { return nil }
        let rounded = Int((Double(d) / 10).rounded()) * 10
        return "~\(rounded)m away"
    }
}

struct ChatMessage: Identifiable {
    let id = UUID()
    let text: String
    let isMine: Bool
}

// MARK: - Match (one conversation)

@Observable
final class Match: Identifiable {
    let id = UUID()
    let profile: Profile
    var messages: [ChatMessage]
    /// When the latest unanswered incoming message arrived. nil once you've replied.
    /// Used by the 48h auto-unmatch rule.
    var awaitingYourReplySince: Date?

    init(profile: Profile, messages: [ChatMessage] = [], awaitingYourReplySince: Date? = nil) {
        self.profile = profile
        self.messages = messages
        self.awaitingYourReplySince = awaitingYourReplySince
    }

    var userHasReplied: Bool { messages.contains { $0.isMine } }
    var lastMessage: String? { messages.last?.text }
}

extension Match: Hashable {
    static func == (lhs: Match, rhs: Match) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

/// A first message that's just "Hey" (any casing / trailing punctuation) is too low-effort
/// and triggers an immediate unmatch.
func isLowEffortGreeting(_ text: String) -> Bool {
    let strip = CharacterSet(charactersIn: " .!?,…").union(.whitespacesAndNewlines)
    let cleaned = text.trimmingCharacters(in: strip).lowercased()
    return cleaned == "hey"
}

// MARK: - Mock data

let mockNearby: [NearbyPerson] = [
    NearbyPerson(initials: "SK", name: "Sophie", age: 24, university: "UZH", degree: "BSc Medicine", distanceMeters: 120, gender: .female),
    NearbyPerson(initials: "NF", name: "Nina", age: 22, university: "ZHAW", degree: "BSc Design", distanceMeters: 200, gender: .female),
    NearbyPerson(initials: "MR", name: "Marco", age: 26, university: "ETH", degree: "MSc Architecture", distanceMeters: 350, gender: .male),
    NearbyPerson(initials: "TA", name: "Tim", age: 21, university: "UZH", degree: "BSc Economics", distanceMeters: 420, gender: .male),
    NearbyPerson(initials: "LB", name: "Lena", age: 23, university: "ETH", degree: "MSc Biology", distanceMeters: 470, gender: .female),
]

let mockProfiles: [Profile] = [
    Profile(name: "Luca", age: 23, university: "ETH Zürich", degree: "MSc Biochemistry", yearOfStudy: "2nd year", bio: "Climbing, jazz piano, and cooking mediocre pasta. Ask me about my thesis on membrane proteins.", avatarColor: Color(red: 0.933, green: 0.929, blue: 0.996), distanceMeters: 180, gender: .male),
    Profile(name: "Sophie", age: 24, university: "UZH", degree: "BSc Medicine", yearOfStudy: "4th year", bio: "Running, cooking, and cinema. Survivor of first-year anatomy.", avatarColor: Color(red: 0.882, green: 0.957, blue: 0.933), distanceMeters: nil, gender: .female),
    Profile(name: "Nina", age: 22, university: "ZHAW", degree: "BSc Design", yearOfStudy: "3rd year", bio: "Illustration, yoga, and collecting too many houseplants.", avatarColor: Color(red: 0.984, green: 0.922, blue: 0.906), distanceMeters: 340, gender: .female),
    Profile(name: "Marco", age: 26, university: "ETH Zürich", degree: "MSc Architecture", yearOfStudy: "1st year", bio: "Photography, cycling, strong opinions about fonts.", avatarColor: Color(red: 0.984, green: 0.918, blue: 0.937), distanceMeters: nil, gender: .male),
    Profile(name: "Lena", age: 23, university: "UZH", degree: "MSc Psychology", yearOfStudy: "1st year", bio: "Reading too much, hiking when not reading.", avatarColor: Color(red: 0.918, green: 0.953, blue: 0.871), distanceMeters: 210, gender: .female),
]

let swissUniversities: [String] = [
    "ETH Zürich", "UZH", "ZHAW", "Universität Bern", "HSG St. Gallen",
    "EPFL", "FHNW", "BFH Bern", "SUPSI", "OST", "FFHS", "HWZ Zürich",
    "ZHdK", "PH Zürich", "Universität Basel", "Universität Luzern",
    "Universität Fribourg", "Universität Neuchâtel", "Universität Genf",
    "HES-SO", "HSLU", "FHO",
]
