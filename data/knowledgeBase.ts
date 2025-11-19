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

      **Optics:**
      - Snell's Law: n_1 * sin(θ_1) = n_2 * sin(θ_2)
      - Lens Maker's Formula: 1/f = (n-1) * (1/R_1 - 1/R_2)
    `,
    CHEMISTRY: `
      **Mole Concept:**
      - 1 mole of any substance contains Avogadro's number of particles (N_A ≈ 6.022 * 10^{23}).
      - Molar Mass is the mass of one mole of a substance in grams.

      **Chemical Bonding:**
      - **Ionic Bonds:** Formed by the transfer of electrons between a metal and a non-metal. Example: NaCl.
      - **Covalent Bonds:** Formed by the sharing of electrons. Example: Methane (CH_4).
      - **Hybridization:** The concept of mixing atomic orbitals to form new hybrid orbitals. sp^3 hybridization in methane results in a tetrahedral geometry.

      **Thermodynamics:**
      - First Law: ΔU = q + w (Change in internal energy = heat + work).
      - Enthalpy (ΔH): Heat change at constant pressure. For an exothermic reaction, ΔH is negative.
      - Gibbs Free Energy (ΔG): ΔG = ΔH - TΔS. If ΔG < 0, the reaction is spontaneous.

      **Organic Chemistry:**
      - **Nomenclature:** IUPAC rules for naming organic compounds. E.g., CH_3CH_2OH is Ethanol.
      - **Isomerism:** Compounds with the same molecular formula (e.g., C_4H_{10}) but different structures (butane and isobutane).
    `,
    MATHS: `
      **Calculus:**
      - **Differentiation:** The derivative of x^n is n*x^{n-1}. The derivative of sin(x) is cos(x).
      - **Integration:** The integral of x^n dx is (x^{n+1})/(n+1) + C.
      - **Fundamental Theorem of Calculus:** Connects differentiation and integration.

      **Trigonometry:**
      - **Pythagorean Identity:** sin^2(x) + cos^2(x) = 1.
      - **Sum and Difference Formulas:** sin(A+B) = sin(A)cos(B) + cos(A)sin(B).
      - The general solution for sin(x) = 0 is x = nπ.

      **Algebra:**
      - **Quadratic Formula:** For ax^2 + bx + c = 0, the solutions are x = [-b ± sqrt(b^2 - 4ac)] / (2a).
      - **Logarithms:** The rule for changing base is log_b(a) = log_c(a) / log_c(b). The natural logarithm, log_e(x), is often written as ln(x).
      - **Binomial Theorem:** (x+y)^n = Σ [nCr * x^{n-r} * y^r] for r from 0 to n.
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