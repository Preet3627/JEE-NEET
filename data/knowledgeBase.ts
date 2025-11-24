
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
      **Sets, Relations and Functions:**
      - **Sets:** Union (A ∪ B), Intersection (A ∩ B), Complement (A').
      - **Functions:** Domain, Co-domain, Range. Injective (One-to-one), Surjective (Onto), Bijective.
      - **Composition:** (fog)(x) = f(g(x)).

      **Complex Numbers:**
      - Standard form: z = a + ib.
      - Modulus: |z| = sqrt(a^2 + b^2).
      - Argument: tan(θ) = b/a.
      - Euler's form: z = r(cos θ + i sin θ) = re^{iθ}.
      - Cube roots of unity: 1, ω, ω^2 where 1 + ω + ω^2 = 0 and ω^3 = 1.

      **Quadratic Equations:**
      - Roots of ax^2 + bx + c = 0 are x = [-b ± sqrt(b^2 - 4ac)] / 2a.
      - Sum of roots (α + β) = -b/a.
      - Product of roots (αβ) = c/a.
      - Discriminant (D) = b^2 - 4ac. If D > 0 (real distinct), D = 0 (real equal), D < 0 (imaginary).

      **Matrices and Determinants:**
      - Matrix multiplication is not commutative (AB ≠ BA usually).
      - Transpose properties: (AB)' = B'A'.
      - Inverse: A^{-1} = adj(A) / |A|. Exists if |A| ≠ 0.
      - Cramer's Rule for solving linear equations.

      **Permutations and Combinations:**
      - nPr = n! / (n-r)!
      - nCr = n! / [r!(n-r)!]
      - Circular permutation: (n-1)!

      **Binomial Theorem:**
      - (x+y)^n = Σ [nCr * x^{n-r} * y^r] for r = 0 to n.
      - General term: T_{r+1} = nCr * x^{n-r} * y^r.

      **Sequence and Series:**
      - **AP:** T_n = a + (n-1)d; S_n = n/2 [2a + (n-1)d].
      - **GP:** T_n = ar^{n-1}; S_n = a(r^n - 1)/(r-1).
      - **AM-GM Inequality:** AM ≥ GM (for positive numbers).

      **Limit, Continuity and Differentiability:**
      - L'Hospital's Rule: If lim f(x)/g(x) is 0/0 or ∞/∞, take derivatives of num and den.
      - Continuity: lim(x->a-) f(x) = lim(x->a+) f(x) = f(a).

      **Integral Calculus:**
      - **Standard Integrals:** ∫x^n dx, ∫e^x dx, ∫1/x dx, ∫sin x dx.
      - **Integration by Parts:** ∫u dv = uv - ∫v du. (ILATE rule).
      - **Definite Integrals:** Properties like ∫_a^b f(x)dx = ∫_a^b f(a+b-x)dx.
      - **Area Under Curve:** ∫_a^b y dx.

      **Differential Equations:**
      - Variable Separable form.
      - Homogeneous Differential Equations (y = vx).
      - Linear Differential Equation: dy/dx + Py = Q. Integrating Factor (IF) = e^{∫P dx}. Solution: y(IF) = ∫(Q * IF) dx + C.

      **Coordinate Geometry:**
      - **Straight Lines:** Slope m = tan θ. Point-slope form: y-y1 = m(x-x1). Distance formula.
      - **Circles:** (x-h)^2 + (y-k)^2 = r^2. Tangent conditions.
      - **Parabola:** y^2 = 4ax. Focus (a, 0).
      - **Ellipse:** x^2/a^2 + y^2/b^2 = 1. Eccentricity e < 1.
      - **Hyperbola:** x^2/a^2 - y^2/b^2 = 1. Eccentricity e > 1.

      **Three Dimensional Geometry:**
      - Direction Cosines (l, m, n) where l^2 + m^2 + n^2 = 1.
      - Equation of a line in space: (x-x1)/a = (y-y1)/b = (z-z1)/c.
      - Equation of a plane: ax + by + cz + d = 0.
      - Shortest distance between skew lines.

      **Vector Algebra:**
      - Dot Product: A · B = |A||B|cosθ. (Scalar product).
      - Cross Product: A × B = |A||B|sinθ n_cap. (Vector product).
      - Projection of A on B = (A · B) / |B|.

      **Statistics and Probability:**
      - Mean, Variance, Standard Deviation.
      - Conditional Probability: P(A|B) = P(A ∩ B) / P(B).
      - Bayes' Theorem.
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
