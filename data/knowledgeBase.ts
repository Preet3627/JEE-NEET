
export const knowledgeBase = {
    PHYSICS: `
      **Newton's Laws of Motion:**
      1.  **First Law (Inertia):** An object remains at rest or in uniform motion unless acted upon by a net external force.
      2.  **Second Law:** The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass (F = ma).
      3.  **Third Law:** For every action, there is an equal and opposite reaction.

      **Work, Energy, and Power:**
      - Work done (W) = F * d * cos(θ)
      - Kinetic Energy (KE) = 1/2 * mv^2
      - Potential Energy (PE) = mgh
      - Power (P) = W / t

      **Rotational Motion:**
      - Torque (τ) = r * F * sin(θ)
      - Moment of Inertia (I) for a solid sphere is 2/5 * MR^2.
      - Angular momentum (L) = I * ω
      - Parallel Axis Theorem: I = I_cm + Md^2

      **Optics:**
      - Snell's Law: n_1 * sin(θ_1) = n_2 * sin(θ_2)
      - Lens Maker's Formula: 1/f = (n-1) * (1/R_1 - 1/R_2)
      - Mirror Formula: 1/f = 1/v + 1/u
    `,
    CHEMISTRY: `
      **Mole Concept:**
      - 1 mole of any substance contains Avogadro's number of particles (N_A ≈ 6.022 * 10^{23}).
      - Molar Mass is the mass of one mole of a substance in grams.

      **Chemical Bonding:**
      - **Ionic Bonds:** Formed by the transfer of electrons between a metal and a non-metal. Example: NaCl.
      - **Covalent Bonds:** Formed by the sharing of electrons. Example: Methane (CH_4).
      - **Hybridization:** The concept of mixing atomic orbitals to form new hybrid orbitals. sp^3 hybridization in methane results in a tetrahedral geometry.
      - **VSEPR Theory:** Predicts geometry based on electron pair repulsion.

      **Thermodynamics:**
      - First Law: ΔU = q + w (Change in internal energy = heat + work).
      - Enthalpy (ΔH): Heat change at constant pressure. For an exothermic reaction, ΔH is negative.
      - Gibbs Free Energy (ΔG): ΔG = ΔH - TΔS. If ΔG < 0, the reaction is spontaneous.

      **Organic Chemistry:**
      - **Nomenclature:** IUPAC rules for naming organic compounds. E.g., CH_3CH_2OH is Ethanol.
      - **Isomerism:** Compounds with the same molecular formula (e.g., C_4H_{10}) but different structures (butane and isobutane).
      - **Reaction Mechanisms:** SN1 (unimolecular, carbocation intermediate) vs SN2 (bimolecular, concerted, inversion of configuration).
    `,
    MATHS: `
      **Calculus:**
      - **Differentiation:** 
        - d/dx(x^n) = n*x^{n-1}
        - d/dx(sin x) = cos x, d/dx(cos x) = -sin x
        - Chain Rule: d/dx[f(g(x))] = f'(g(x)) * g'(x)
      - **Integration:** 
        - ∫x^n dx = (x^{n+1})/(n+1) + C (n ≠ -1)
        - ∫(1/x) dx = ln|x| + C
        - Integration by Parts: ∫u dv = uv - ∫v du
      - **Definite Integrals:** Area under curve from a to b.

      **Trigonometry:**
      - **Identities:** sin^2(x) + cos^2(x) = 1, 1 + tan^2(x) = sec^2(x)
      - **Double Angle:** sin(2A) = 2sinAcosA, cos(2A) = cos^2A - sin^2A
      - **Sum/Diff:** sin(A+B) = sinAcosB + cosAsinB
      - **General Solutions:** If sin x = sin α, then x = nπ + (-1)^n α.

      **Algebra:**
      - **Quadratic Formula:** For ax^2 + bx + c = 0, x = [-b ± sqrt(b^2 - 4ac)] / (2a).
      - **Sequence & Series:** AP sum S_n = n/2 [2a + (n-1)d]; GP sum S_n = a(r^n - 1)/(r-1).
      - **Binomial Theorem:** (x+y)^n = Σ [nCr * x^{n-r} * y^r]
      - **Complex Numbers:** z = a + ib, modulus |z| = sqrt(a^2 + b^2). Euler's form: e^{iθ} = cos θ + i sin θ.

      **Coordinate Geometry:**
      - **Straight Line:** y = mx + c (slope-intercept), ax + by + c = 0.
      - **Circle:** (x-h)^2 + (y-k)^2 = r^2.
      - **Conic Sections:** Parabola (y^2 = 4ax), Ellipse (x^2/a^2 + y^2/b^2 = 1), Hyperbola (x^2/a^2 - y^2/b^2 = 1).
      
      **Vectors & 3D:**
      - **Dot Product:** A · B = |A||B|cosθ.
      - **Cross Product:** A × B = |A||B|sinθ n_cap.
    `,
    BIOLOGY: `
      **Cell Biology:**
      - **Cell Theory:** All living organisms are composed of cells; the cell is the basic unit of life; all cells arise from pre-existing cells.
      - **Mitochondria:** Powerhouse of the cell, site of cellular respiration and ATP synthesis.
      - **Mitosis:** Cell division resulting in two diploid (2n) daughter cells. Stages: Prophase, Metaphase, Anaphase, Telophase.
      
      **Genetics:**
      - **Mendel's Laws:** Law of Segregation, Law of Independent Assortment.
      - **DNA Structure:** Double helix model by Watson and Crick, composed of nucleotides (A, T, C, G).
      - **Central Dogma:** DNA -> RNA -> Protein. (Transcription -> Translation).

      **Human Physiology:**
      - **Nervous System:** Neurons transmit signals via action potentials. The synapse is the junction between two neurons.
      - **Endocrine System:** Hormones like insulin (regulates blood sugar) and adrenaline (fight or flight) regulate body functions.
      - **Circulatory System:** The heart pumps blood through arteries, veins, and capillaries. Red blood cells carry oxygen via hemoglobin.

      **Plant Physiology:**
      - **Photosynthesis:** 6CO_2 + 6H_2O + Light Energy -> C_6H_{12}O_6 + 6O_2. Occurs in chloroplasts.
      - **Transpiration:** The loss of water vapor from plants, primarily through stomata.
      - **Plant Hormones:** Auxins (growth), Gibberellins (stem elongation), Cytokinins (cell division).
      
      **Ecology:**
      - **Food Chain:** The sequence of transfers of matter and energy in the form of food from organism to organism.
      - **Ecological Succession:** The process of change in the species structure of an ecological community over time.
      - **Biomes:** Major life zones characterized by vegetation type (e.g., tropical rainforest, desert).
    `,
};
