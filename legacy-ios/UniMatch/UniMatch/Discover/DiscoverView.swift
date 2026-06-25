import SwiftUI

struct DiscoverView: View {
    @Environment(AppState.self) private var appState
    @State private var topIndex = 0
    @State private var drag: CGSize = .zero
    @State private var showFilters = ProcessInfo.processInfo.environment["UM_FILTERS"] == "1"

    private let swipeThreshold: CGFloat = 100
    private let flyThreshold: CGFloat = 140

    private var deck: [Profile] { appState.filteredProfiles }

    var body: some View {
        @Bindable var state = appState
        ZStack(alignment: .top) {
            VStack(spacing: 0) {
                cardArea
                if topIndex < deck.count {
                    actionButtons
                        .padding(.top, 20)
                        .padding(.bottom, 12)
                }
            }
            .padding(.horizontal, Theme.screenPadding)

            // Filter panel drops down from the top.
            if showFilters {
                Color.black.opacity(0.12)
                    .ignoresSafeArea()
                    .onTapGesture { closeFilters() }
                    .transition(.opacity)

                FilterPanel(filters: $state.filters, onClose: closeFilters)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(1)
            }
        }
        .navigationTitle("Discover")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                        showFilters.toggle()
                    }
                } label: {
                    Image(systemName: appState.filters.isActive
                          ? "line.3.horizontal.decrease.circle.fill"
                          : "line.3.horizontal.decrease.circle")
                        .foregroundStyle(appState.filters.isActive ? Theme.accent : Color(.label))
                }
            }
        }
    }

    private func closeFilters() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
            showFilters = false
        }
        topIndex = 0   // re-deal the deck under the new filters
    }

    private var cardArea: some View {
        ZStack {
            if topIndex >= deck.count {
                emptyState
            } else {
                // Next card peeking behind, scaled 0.95
                if topIndex + 1 < deck.count {
                    CardView(profile: deck[topIndex + 1],
                             showDistance: appState.isNearbyModeOn,
                             dragOffset: .zero)
                        .scaleEffect(0.95)
                        .offset(y: 12)
                }
                let profile = deck[topIndex]
                CardView(profile: profile,
                         showDistance: appState.isNearbyModeOn,
                         dragOffset: drag)
                    .offset(drag)
                    .rotationEffect(.degrees(Double(drag.width / 300 * 12)), anchor: .bottom)
                    .gesture(
                        DragGesture()
                            .onChanged { drag = $0.translation }
                            .onEnded { value in onDragEnd(value, profile: profile) }
                    )
                    .animation(.spring(response: 0.35, dampingFraction: 0.7), value: drag)
            }
        }
        .frame(maxHeight: .infinity)
    }

    private func onDragEnd(_ value: DragGesture.Value, profile: Profile) {
        let w = value.translation.width
        if w > flyThreshold {
            fly(right: true, profile: profile)
        } else if w < -flyThreshold {
            fly(right: false, profile: profile)
        } else {
            drag = .zero
        }
    }

    private func fly(right: Bool, profile: Profile) {
        if right { appState.like(profile) }
        withAnimation(.easeOut(duration: 0.3)) {
            drag = CGSize(width: right ? 700 : -700, height: 0)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
            drag = .zero
            topIndex += 1
        }
    }

    private func tapAction(right: Bool) {
        guard topIndex < deck.count else { return }
        fly(right: right, profile: deck[topIndex])
    }

    private var actionButtons: some View {
        HStack(spacing: 48) {
            circleButton(icon: "xmark", tint: .red) { tapAction(right: false) }
            circleButton(icon: "heart", tint: Theme.accent) { tapAction(right: true) }
        }
    }

    private func circleButton(icon: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(tint)
                .frame(width: 52, height: 52)
                .overlay(Circle().stroke(Theme.separator, lineWidth: 0.5))
        }
        .buttonStyle(.plain)
    }

    private var emptyState: some View {
        let noneMatchFilters = deck.isEmpty && appState.filters.isActive
        return VStack(spacing: 12) {
            Image(systemName: noneMatchFilters ? "line.3.horizontal.decrease.circle" : "rectangle.on.rectangle")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text(noneMatchFilters ? "No one matches your filters" : "That's everyone for now")
                .font(.umBody.weight(.medium))
            Text(noneMatchFilters ? "Loosen your filters to see more students." : "Check back later for new students nearby.")
                .font(.umCaption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button(noneMatchFilters ? "Adjust filters" : "Start over") {
                if noneMatchFilters { showFilters = true } else { topIndex = 0 }
            }
            .buttonStyle(OutlinedCTAStyle())
            .padding(.top, 12)
            .frame(maxWidth: 200)
        }
    }
}

// MARK: - Card

struct CardView: View {
    let profile: Profile
    let showDistance: Bool
    let dragOffset: CGSize

    private var likeOpacity: Double { Double(max(0, min(1, dragOffset.width / 100))) }
    private var passOpacity: Double { Double(max(0, min(1, -dragOffset.width / 100))) }

    var body: some View {
        VStack(spacing: 0) {
            photoArea
            infoSection
        }
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cardRadius)
                .stroke(Theme.separator, lineWidth: 0.5)
        )
    }

    private var photoArea: some View {
        ZStack {
            profile.avatarColor
            Image(systemName: "person.fill")
                .font(.system(size: 80))
                .foregroundStyle(Theme.uniTagText.opacity(0.5))

            VStack {
                HStack(alignment: .top) {
                    TagPill(text: profile.university, bg: Theme.uniTagBg, fg: Theme.uniTagText)
                    Spacer()
                    if showDistance, let d = profile.distanceLabel {
                        TagPill(text: d, bg: Theme.distancePillBg, fg: Theme.distancePillText)
                    }
                }
                Spacer()
            }
            .padding(12)

            // Drag stamps
            VStack {
                HStack {
                    Text("LIKE")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Color(red: 0.031, green: 0.6, blue: 0.4))
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .overlay(RoundedRectangle(cornerRadius: 6)
                            .stroke(Color(red: 0.031, green: 0.6, blue: 0.4), lineWidth: 2))
                        .rotationEffect(.degrees(-18))
                        .opacity(likeOpacity)
                    Spacer()
                    Text("PASS")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.red)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.red, lineWidth: 2))
                        .rotationEffect(.degrees(18))
                        .opacity(passOpacity)
                }
                Spacer()
            }
            .padding(20)
        }
        .frame(height: 340)
    }

    private var infoSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(profile.name), \(profile.age)")
                .font(.system(size: 17, weight: .medium))
            Text("\(profile.degree) · \(profile.yearOfStudy)")
                .font(.umCaption)
                .foregroundStyle(.secondary)
            HairlineDivider()
            Text(profile.bio)
                .font(.umCaption)
                .foregroundStyle(.secondary)
                .lineLimit(3)
            Text("more")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.accent)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
    }
}

// MARK: - Filter panel (drops from top)

struct FilterPanel: View {
    @Binding var filters: DiscoverFilters
    let onClose: () -> Void

    private let bounds = DiscoverFilters.ageBounds

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.sectionSpacing) {
            header

            // Age
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Age").font(.system(size: 16, weight: .medium))
                    Spacer()
                    Text("\(filters.minAge) – \(filters.maxAge)")
                        .font(.umBody)
                        .foregroundStyle(Theme.accent)
                }
                RangeSlider(lower: $filters.minAge, upper: $filters.maxAge, bounds: bounds)
                    .frame(height: 28)
            }

            // Gender
            VStack(alignment: .leading, spacing: 12) {
                Text("Gender").font(.system(size: 16, weight: .medium))
                FlowLayout(spacing: 8) {
                    ForEach(Gender.allCases) { gender in
                        FilterChip(
                            label: gender.rawValue,
                            icon: nil,
                            isSelected: filters.genders.contains(gender)
                        ) { toggleGender(gender) }
                    }
                }
            }

            // Field of studies
            VStack(alignment: .leading, spacing: 12) {
                Text("Field of studies").font(.system(size: 16, weight: .medium))
                FlowLayout(spacing: 8) {
                    FilterChip(label: "All", icon: nil, isSelected: filters.level == nil) {
                        filters.level = nil
                    }
                    ForEach(StudyLevel.allCases) { level in
                        FilterChip(label: level.rawValue, icon: nil, isSelected: filters.level == level) {
                            filters.level = level
                        }
                    }
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground))
        .clipShape(.rect(bottomLeadingRadius: 20, bottomTrailingRadius: 20))
        .overlay(alignment: .bottom) { HairlineDivider() }
    }

    private var header: some View {
        HStack {
            Button("Reset") { filters = DiscoverFilters() }
                .font(.umButton)
                .foregroundStyle(filters.isActive ? Theme.accent : Color(.tertiaryLabel))
                .disabled(!filters.isActive)
            Spacer()
            Text("Filters").font(.system(size: 16, weight: .medium))
            Spacer()
            Button("Done", action: onClose)
                .font(.umButton)
                .foregroundStyle(Theme.accent)
        }
    }

    private func toggleGender(_ gender: Gender) {
        if filters.genders.contains(gender) {
            if filters.genders.count > 1 { filters.genders.remove(gender) }  // keep ≥1
        } else {
            filters.genders.insert(gender)
        }
    }
}

// MARK: - Filter chip

struct FilterChip: View {
    let label: String
    let icon: String?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .medium))
                } else if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 11, weight: .regular))
                }
                Text(label).font(.umButton)
            }
            .foregroundStyle(isSelected ? Theme.uniTagText : Color(.secondaryLabel))
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background(isSelected ? Theme.uniTagBg : Theme.surface)
            .overlay(
                Capsule().stroke(isSelected ? Theme.accent : Theme.separator,
                                 lineWidth: isSelected ? 1.5 : 0.5)
            )
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.15), value: isSelected)
    }
}

// MARK: - Dual-thumb range slider

struct RangeSlider: View {
    @Binding var lower: Int
    @Binding var upper: Int
    let bounds: ClosedRange<Int>
    var minGap: Int = 1

    private let thumb: CGFloat = 26
    private let trackHeight: CGFloat = 5

    var body: some View {
        GeometryReader { geo in
            let usable = max(geo.size.width - thumb, 1)
            let span = CGFloat(bounds.upperBound - bounds.lowerBound)
            let xLower = usable * CGFloat(lower - bounds.lowerBound) / span
            let xUpper = usable * CGFloat(upper - bounds.lowerBound) / span

            ZStack(alignment: .leading) {
                // Full track
                Capsule()
                    .fill(Theme.surface)
                    .frame(height: trackHeight)
                    .overlay(Capsule().stroke(Theme.separator, lineWidth: 0.5))
                    .padding(.horizontal, thumb / 2)

                // Selected range
                Capsule()
                    .fill(Theme.accent)
                    .frame(width: max(xUpper - xLower, 0), height: trackHeight)
                    .offset(x: xLower + thumb / 2)

                thumbView
                    .offset(x: xLower)
                    .gesture(dragGesture(usable: usable, span: span, isLower: true))
                thumbView
                    .offset(x: xUpper)
                    .gesture(dragGesture(usable: usable, span: span, isLower: false))
            }
            .frame(height: thumb)
        }
    }

    private var thumbView: some View {
        Circle()
            .fill(Color(.systemBackground))
            .frame(width: thumb, height: thumb)
            .overlay(Circle().stroke(Theme.accent, lineWidth: 2))
            .overlay(Circle().fill(Theme.accent).frame(width: 8, height: 8))
    }

    private func dragGesture(usable: CGFloat, span: CGFloat, isLower: Bool) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                let ratio = max(0, min(1, (value.location.x - thumb / 2) / usable))
                let raw = bounds.lowerBound + Int((ratio * span).rounded())
                if isLower {
                    lower = min(max(bounds.lowerBound, raw), upper - minGap)
                } else {
                    upper = max(min(bounds.upperBound, raw), lower + minGap)
                }
            }
    }
}

#Preview {
    NavigationStack { DiscoverView() }.environment(AppState())
}
